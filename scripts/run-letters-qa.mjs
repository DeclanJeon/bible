#!/usr/bin/env node

import Module from "node:module";
import { createRequire } from "node:module";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const requireFromRepo = createRequire(import.meta.url);
const ts = requireFromRepo("typescript");

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : `\n${typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)}`;
    throw new Error(`${message}${suffix}`);
  }
}

function loadTsModule(relativePath, stubs = {}) {
  const filename = join(repoRoot, relativePath);
  const source = readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });

  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  mod.require = (id) => {
    if (Object.prototype.hasOwnProperty.call(stubs, id)) {
      return stubs[id];
    }
    return requireFromRepo(id);
  };
  mod._compile(outputText, filename);
  return mod.exports;
}

function collectForbiddenKeys(value, forbiddenKeyPattern, path = "$", leaks = []) {
  if (!value || typeof value !== "object") return leaks;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenKeys(item, forbiddenKeyPattern, `${path}[${index}]`, leaks));
    return leaks;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (forbiddenKeyPattern.test(key)) {
      leaks.push(childPath);
    }
    collectForbiddenKeys(child, forbiddenKeyPattern, childPath, leaks);
  }
  return leaks;
}

function collectForbiddenStrings(value, forbiddenValues, path = "$", leaks = []) {
  if (typeof value === "string") {
    for (const secret of forbiddenValues) {
      if (secret && value.includes(secret)) {
        leaks.push(`${path} contains ${secret}`);
      }
    }
    return leaks;
  }
  if (!value || typeof value !== "object") return leaks;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenStrings(item, forbiddenValues, `${path}[${index}]`, leaks));
    return leaks;
  }
  for (const [key, child] of Object.entries(value)) {
    collectForbiddenStrings(child, forbiddenValues, `${path}.${key}`, leaks);
  }
  return leaks;
}

function assertPublicBundleSanitized(bundle, label, forbiddenValues = []) {
  const forbiddenKeyLeaks = collectForbiddenKeys(
    bundle,
    /^(authorEmail|authorEmailHash|authorEmailEncrypted|recipientEmail|recipientEmailHash|replyTokenHash|readTokenHash|readToken)$/,
  );
  assert(forbiddenKeyLeaks.length === 0, `${label} public bundle must not expose email or token fields`, forbiddenKeyLeaks);

  const forbiddenValueLeaks = collectForbiddenStrings(bundle, forbiddenValues);
  assert(forbiddenValueLeaks.length === 0, `${label} public bundle must not expose user email values`, forbiddenValueLeaks);
}

const LETTER_CARD_DRIVE_FOLDER_ID = "1MsLyYIsnAH93ZvPokzie784BuBqj4PE7";
const LETTER_CARD_DRIVE_FOLDER_ENV = "LETTERS_CARD_IMAGE_DRIVE_FOLDER_ID";

function expectedDriveCardImageSrc(cardId) {
  return `https://drive.google.com/uc?export=view&id=qa-drive-${cardId}`;
}

function htmlAttributeValue(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function localizedCardImageRoute(cardId, locale) {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://bible.ponslink.test").replace(/\/$/, "");
  return `${baseUrl}/${locale}/api/letters/card/${cardId}/image`;
}

function unlocalizedCardImageRoute(cardId) {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://bible.ponslink.test").replace(/\/$/, "");
  return `${baseUrl}/api/letters/card/${cardId}/image`;
}

function assertEmailHtmlDoesNotLeakInternalValues(message, label, forbiddenValues = []) {
  const html = message?.html ?? "";
  const forbiddenFragments = [
    "authorEmail",
    "recipientEmail",
    "replyTokenHash",
    "readTokenHash",
    "generationMetadata",
    ...forbiddenValues,
  ].filter(Boolean);
  const leaks = forbiddenFragments.filter((fragment) => html.includes(fragment));
  assert(leaks.length === 0, `${label} email HTML must not expose internal metadata, token fields, raw emails, or provider errors`, { leaks, html });
}

function assertEmailHtmlContainsDesignedFallbackCard({ label, message, card, expectedCtaPath, expectedCtaText, forbiddenValues = [] }) {
  const html = message?.html ?? "";
  const expectedFragments = [
    { name: "card title", value: card?.title },
    { name: "card summary", value: card?.summary },
    { name: "scripture reference", value: card?.scripture?.reference },
    { name: "scripture text", value: card?.scripture?.text },
    { name: "CTA URL", value: expectedCtaPath },
    { name: "CTA text", value: expectedCtaText },
  ];
  const missingFragments = expectedFragments
    .filter(({ value }) => typeof value === "string" && value.length > 0)
    .filter(({ value }) => !html.includes(htmlAttributeValue(value)))
    .map(({ name, value }) => ({ name, value }));
  const hasEmailSafeCardWrapper = /<(?:table|td|div)\b[^>]*style="[^"]*(?:background|border|border-radius|padding)[^"]*"/i.test(html);
  const hasBrokenImagePlaceholder = /<img\b[^>]*\bsrc=(?:""|'')/i.test(html);

  assert(
    missingFragments.length === 0 && hasEmailSafeCardWrapper && !hasBrokenImagePlaceholder,
    `${label} email HTML must render a designed card with scripture and CTA when image generation returns no image URL`,
    { missingFragments, hasEmailSafeCardWrapper, hasBrokenImagePlaceholder, html },
  );
  assertEmailHtmlDoesNotLeakInternalValues(message, label, forbiddenValues);
}

function assertEmailHtmlContainsGeneratedImage({ label, message, expectedImageUrl, expectedAltText }) {
  const html = message?.html ?? "";
  const expectedSrc = htmlAttributeValue(expectedImageUrl);
  const expectedAlt = htmlAttributeValue(expectedAltText);
  const failures = [];
  if (!/^https?:\/\//i.test(expectedImageUrl)) {
    failures.push({ label, expectedImageUrl, reason: "expected image URL is not remote" });
  }
  if (!html.includes(`src="${expectedSrc}"`)) {
    failures.push({ label, expectedImageUrl, expectedHtmlSrc: expectedSrc, html });
  }
  if (!html.includes(`alt="${expectedAlt}"`)) {
    failures.push({ label, expectedAltText, expectedHtmlAlt: expectedAlt, html });
  }
  assert(failures.length === 0, `${label} email HTML must embed the generated remote image with useful alt text`, failures);
}

function forbiddenCardImageRoutes(cardId, locale) {
  return [
    { name: "localized absolute server image route", value: localizedCardImageRoute(cardId, locale) },
    { name: "root absolute server image route", value: unlocalizedCardImageRoute(cardId) },
    { name: "localized server image route path", value: `/${locale}/api/letters/card/${cardId}/image` },
    { name: "root server image route path", value: `/api/letters/card/${cardId}/image` },
  ];
}

function assertEmailHtmlUsesImageHeroBeforeCtaAndTextFallback({
  label,
  message,
  card,
  expectedImageUrl,
  expectedCtaPath,
  expectedCtaText,
  expectedFallbackLabel,
}) {
  const html = message?.html ?? "";
  const expectedSrc = `src="${htmlAttributeValue(expectedImageUrl)}"`;
  const expectedCtaHref = htmlAttributeValue(expectedCtaPath);
  const expectedCtaLabel = htmlAttributeValue(expectedCtaText);
  const expectedTextFallbackLabel = htmlAttributeValue(expectedFallbackLabel);
  const imageIndex = html.indexOf(expectedSrc);
  const ctaHrefIndex = html.indexOf(expectedCtaHref);
  const ctaLabelIndex = html.indexOf(expectedCtaLabel);
  const ctaEndIndex = Math.max(ctaHrefIndex, ctaLabelIndex);
  const fallbackLabelIndex = html.indexOf(expectedTextFallbackLabel);
  const fallbackFragments = [
    { name: "fallback label", value: expectedFallbackLabel, index: fallbackLabelIndex },
    { name: "fallback scripture reference", value: card?.scripture?.reference, index: html.indexOf(htmlAttributeValue(card?.scripture?.reference)) },
    { name: "fallback scripture text", value: card?.scripture?.text, index: html.indexOf(htmlAttributeValue(card?.scripture?.text)) },
    { name: "fallback body", value: card?.summary, index: html.indexOf(htmlAttributeValue(card?.summary)) },
  ].filter(({ value }) => typeof value === "string" && value.length > 0);
  const missingFragments = [
    { name: "image src", index: imageIndex, value: expectedImageUrl },
    { name: "CTA URL", index: ctaHrefIndex, value: expectedCtaPath },
    { name: "CTA text", index: ctaLabelIndex, value: expectedCtaText },
    ...fallbackFragments,
  ].filter(({ index }) => index < 0);
  const orderingFailures = [];
  if (imageIndex >= 0 && ctaHrefIndex >= 0 && imageIndex > ctaHrefIndex) {
    orderingFailures.push({ expected: "generated image before CTA URL", imageIndex, ctaHrefIndex });
  }
  if (ctaEndIndex >= 0 && fallbackLabelIndex >= 0 && ctaEndIndex > fallbackLabelIndex) {
    orderingFailures.push({ expected: "CTA before visible text fallback label", ctaEndIndex, fallbackLabelIndex });
  }
  for (const fragment of fallbackFragments.filter(({ name }) => name !== "fallback label")) {
    if (fallbackLabelIndex >= 0 && fragment.index >= 0 && fallbackLabelIndex > fragment.index) {
      orderingFailures.push({ expected: "visible text fallback label before fallback body fragment", fragment: fragment.name, fallbackLabelIndex, fragmentIndex: fragment.index });
    }
    if (ctaEndIndex >= 0 && fragment.index >= 0 && ctaEndIndex > fragment.index) {
      orderingFailures.push({ expected: "CTA before text fallback body fragment", fragment: fragment.name, ctaEndIndex, fragmentIndex: fragment.index });
    }
  }

  assert(
    missingFragments.length === 0 && orderingFailures.length === 0,
    `${label} email HTML must render the generated image as the hero, place the CTA before the visible text fallback, and label the fallback block`,
    { missingFragments, orderingFailures, html },
  );
}

function assertEmailsUseReturnedDriveCardImageUrls(checks) {
  const failures = [];
  for (const { label, message, card, cardId, locale, expectedImageUrl, expectedAltText, expectedCtaPath, expectedCtaText, expectedFallbackLabel, forbiddenValues = [] } of checks) {
    const html = message?.html ?? "";
    try {
      assertEmailHtmlContainsGeneratedImage({ label, message, expectedImageUrl, expectedAltText });
    } catch (error) {
      failures.push({ label, error: error.message });
    }
    try {
      assertEmailHtmlUsesImageHeroBeforeCtaAndTextFallback({ label, message, card, expectedImageUrl, expectedCtaPath, expectedCtaText, expectedFallbackLabel });
    } catch (error) {
      failures.push({ label, error: error.message });
    }
    try {
      assertEmailHtmlDoesNotLeakInternalValues(message, label, forbiddenValues);
    } catch (error) {
      failures.push({ label, error: error.message });
    }
    const routeLeaks = forbiddenCardImageRoutes(cardId, locale).filter(({ value }) => html.includes(value));
    if (routeLeaks.length > 0) {
      failures.push({
        label,
        routeLeaks,
        html,
      });
    }
  }
  assert(failures.length === 0, "generated letter and reply email HTML must use returned Drive image URLs as the hero before privacy-safe CTAs, reject localized/root server image routes, and expose only a labeled text fallback after the CTA", failures);
}

function assertCardsStoreReturnedDriveImageUrls(cards, checks) {
  const failures = [];
  for (const { label, cardId, expectedImageUrl } of checks) {
    const card = cards.find((entry) => entry.id === cardId);
    if (card?.imageUrl !== expectedImageUrl) {
      failures.push({ label, cardId, expectedImageUrl, actualImageUrl: card?.imageUrl });
    }
    if (typeof card?.imageUrl === "string" && card.imageUrl.includes(`/api/letters/card/${cardId}/image`)) {
      failures.push({ label, cardId, forbiddenImageUrl: card.imageUrl });
    }
  }
  assert(failures.length === 0, "stored generated cards must keep the returned Drive image URL instead of a persistent server image route", failures);
}

function assertCardPageImagesUseServerProxy(letters, checks) {
  const failures = [];
  for (const { label, card, locale } of checks) {
    const imageSrc = letters.makeCardPageImageSrc(card, locale);
    const expectedSrc = `/${locale}/api/letters/card/${card.id}/image`;
    if (imageSrc !== expectedSrc) {
      failures.push({ label, expectedSrc, actualImageSrc: imageSrc });
    }
    if (typeof imageSrc === "string" && imageSrc.includes("drive.google.com")) {
      failures.push({ label, reason: "page image source must not use the raw Drive URL", imageSrc });
    }
  }
  assert(failures.length === 0, "letter/card pages must render generated images through the first-party image route so Drive redirects cannot break the browser view", failures);
}

async function assertCardImageRouteProxiesStoredDriveImage() {
  const expectedImageUrl = expectedDriveCardImageSrc("card-route");
  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    return new Response("webp-bytes", {
      status: 200,
      headers: { "content-type": "image/webp" },
    });
  };

  try {
    const route = loadTsModule("app/[locale]/api/letters/card/[cardId]/image/route.ts", {
      "node:fs/promises": {
        stat: async () => {
          throw new Error("local image missing");
        },
        readFile: async () => {
          throw new Error("remote proxy test must not read a local image file");
        },
      },
      "next/server": {
        NextResponse: class TestNextResponse extends Response {
          static json(body, init) {
            return Response.json(body, init);
          }
        },
      },
      "@/lib/letters": {
        getStoredCardImageUrl: async (cardId) => {
          assert(cardId === "card-route", "card image route must sanitize and pass the requested card id to storage lookup", { cardId });
          return expectedImageUrl;
        },
      },
    });
    const response = await route.GET(new Request("https://bible.ponslink.test/ko/api/letters/card/card-route/image"), {
      params: Promise.resolve({ cardId: "card-route" }),
    });
    assert(response.status === 200, "card image route must return proxied remote image responses", { status: response.status });
    assert(response.headers.get("content-type") === "image/webp", "card image route must preserve remote image content type", { contentType: response.headers.get("content-type") });
    assert(response.headers.get("x-content-type-options") === "nosniff", "card image route must keep proxied image responses nosniff-protected", { headers: Object.fromEntries(response.headers.entries()) });
    assert(await response.text() === "webp-bytes", "card image route must stream the remote image body");
    assert(fetchCalls.length === 1 && fetchCalls[0].url === expectedImageUrl && fetchCalls[0].options.redirect === "follow", "card image route must fetch the stored Drive URL with redirects enabled", fetchCalls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const MIC_PROMPT_MARKER = "micah-locale-regression";
const IMAGE_FALLBACK_MARKER = "image-fallback-regression";
const IMAGE_FALLBACK_PROVIDER_ERRORS = [
  "image renderer failed with provider stack trace",
  "codex-imagen internal queue skipped image generation",
];


function recommendationPrimaryFor(prompt, locale) {
  if (prompt.includes(MIC_PROMPT_MARKER)) {
    return {
      reference: { code: "MIC", chapter: 6, startVerse: 8, endVerse: 8 },
      text: locale === "ko"
        ? "사람아 주께서 선한 것이 무엇임을 네게 보이셨나니"
        : "He has shown you, O man, what is good.",
      reason: locale === "ko"
        ? "정의와 인자와 겸손한 동행을 붙듭니다."
        : "It anchors justice, mercy, and humble walking with God.",
    };
  }

  return {
    reference: { code: "PSA", chapter: 23, startVerse: 1, endVerse: 4 },
    text: locale === "ko" ? "여호와는 나의 목자시니 내게 부족함이 없으리로다" : "The LORD is my shepherd; I shall not want.",
    reason: locale === "ko" ? "하나님의 돌보심을 붙듭니다." : "It anchors comfort in God's care.",
  };
}

function makeRecommendation(prompt, locale) {
  const crisis = /crisis|self[-\s]?harm|자해|죽고 싶/i.test(prompt);
  const primary = recommendationPrimaryFor(prompt, locale);
  const relatedPassageDetails = Array.from({ length: 11 }, (_, index) => {
    const verse = index + 5;
    return {
      reference: { code: "PSA", chapter: 23, startVerse: verse, endVerse: verse },
      referenceLabel: locale === "ko" ? `시편 23:${verse}` : `Psalm 23:${verse}`,
      excerpt: locale === "ko" ? `${verse}. 추천 성구 본문 ${verse}` : `${verse}. Suggested passage text ${verse}`,
      reason: locale === "ko" ? `추천 이유 ${verse}` : `Suggestion reason ${verse}`,
      href: `/${locale}/bible/PSA.23.${verse}`,
    };
  });
  return {
    safety: {
      level: crisis ? "crisis" : "safe",
      reasons: crisis ? ["crisis-language"] : [],
    },
    recommendation: {
      primary,
      readerHref: `/${locale}/bible/${primary.reference.code}.${primary.reference.chapter}.${primary.reference.startVerse}`,
      confidence: 0.91,
    },
    relatedPassageDetails,
  };
}

function assertLocalizedMicahCard(card, label, expected) {
  assert(card?.title === expected.title, `${label} card title must use the selected output locale`, { expected, card });
  assert(card?.shareUrl?.includes(`/${expected.locale}/letters/card/`), `${label} card share URL must use the selected output locale`, { expected, card });
  assert(card?.scripture?.reference === expected.reference, `${label} scripture reference must use the selected locale book title`, { expected, scripture: card?.scripture });
  assert(card?.scripture?.reference !== "MIC 6:8", `${label} scripture reference must not expose the canonical book code as the user-facing label`, card?.scripture);
  assert(card?.scripture?.href === `/${expected.locale}/bible/MIC.6.8`, `${label} scripture href must use the selected output locale`, { expected, scripture: card?.scripture });
}

async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}


function assertNoGenerationMetadata(bundle, label, forbiddenValues = []) {
  const metadataKeyLeaks = collectForbiddenKeys(bundle, /^generationMetadata$/);
  assert(metadataKeyLeaks.length === 0, `${label} public bundle must not expose card generationMetadata`, metadataKeyLeaks);

  const metadataValueLeaks = collectForbiddenStrings(bundle, forbiddenValues);
  assert(metadataValueLeaks.length === 0, `${label} public bundle must not expose sensitive generation metadata values`, metadataValueLeaks);
}

const originalEnv = { ...process.env };
const tempDir = await mkdtemp(join(tmpdir(), "letters-qa-"));
const cardGenerationCalls = [];
const cardGenerationResults = new Map();
const cardGenerationWaiters = [];
const emailCalls = [];

try {
  process.env.NODE_ENV = "test";
  process.env.LETTERS_DATA_FILE = join(tempDir, "letters.json");
  process.env.LETTERS_RECIPIENT_EMAILS = "helper@example.test";
  delete process.env.LETTERS_SYSTEM_CREATOR_EMAIL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://bible.ponslink.test";
  process.env.LETTERS_EMAIL_ENCRYPTION_KEY = "qa-email-encryption-key";
  delete process.env.SMTP_HOST;
  delete process.env.LETTERS_ENABLE_CODEX_IMAGEN;

  const letters = loadTsModule("lib/letters.ts", {
    "@/lib/book-metadata": {
      getBookMetadata: (code, locale) => ({
        code,
        title: locale === "ko" ? ({ MIC: "미가", PSA: "시편" }[code] ?? code) : ({ MIC: "Micah", PSA: "Psalm" }[code] ?? code),
      }),
    },
    "@/lib/bible": {
      getPassage: async (reference, locale) => ({
        reference: `${locale === "ko" ? "시편" : "Psalm"} ${reference.chapter}:${reference.startVerse}`,
        verses: Array.from({ length: reference.endVerse - reference.startVerse + 1 }, (_, index) => {
          const verse = reference.startVerse + index;
          return { verse, text: locale === "ko" ? `추천 성구 본문 ${verse}` : `Suggested passage text ${verse}` };
        }),
      }),
    },
    "@/lib/content": {
      resolveAppLocale: (locale) => (locale === "en" ? "en" : "ko"),
    },
    "@/lib/navigation": {
      buildBibleReferenceHref: (reference, options) => `/${options?.locale ?? "ko"}/bible/${reference.code}.${reference.chapter}.${reference.startVerse}`,
    },
    "@/lib/bible-reference-parser": {
      parseBibleReferences: (input) => {
        const normalized = String(input);
        const match = normalized.match(/(?:시편|Psalm)\s*(\d+)\s*[:：]\s*(\d+)(?:\s*[-–~]\s*(\d+))?/i);
        if (!match) return [];
        return [{
          code: "PSA",
          chapter: Number(match[1]),
          startVerse: Number(match[2]),
          endVerse: Number(match[3] ?? match[2]),
        }];
      },
    },
    "@/lib/letter-env": {
      loadLettersEmailEnv: () => undefined,
    },
    "@/lib/passage-response": {
      buildPassageRecommendation: async (prompt, options) => makeRecommendation(prompt, options?.locale ?? "ko"),
    },
    "@/lib/letter-card-generator": {
      queueCardImageGeneration: (card, context) => {
        const call = { cardId: card.id, kind: card.kind, locale: context.locale };
        const forceMissingImage = String(context.body).includes(IMAGE_FALLBACK_MARKER);
        const result = forceMissingImage
          ? {
              status: card.kind === "question" ? "failed" : "skipped",
              metadata: { provider: "codex-imagen", error: IMAGE_FALLBACK_PROVIDER_ERRORS[card.kind === "question" ? 0 : 1] },
            }
          : {
              status: "ready",
              imageUrl: expectedDriveCardImageSrc(card.id),
              metadata: { provider: "codex-imagen", reason: "test mock" },
            };
        cardGenerationCalls.push(call);
        cardGenerationResults.set(card.id, result);
        cardGenerationWaiters.shift()?.(call);
        return Promise.resolve(result);
      },
    },
    "@/lib/letter-email": {
      sendSystemEmail: async (message) => {
        emailCalls.push(message);
        return emailCalls.length === 1
          ? { ok: false, skipped: true, error: "SMTP env is not configured" }
          : { ok: true };
      },
    },
  });

  const authorEmail = "author@example.test";
  const helperEmail = "helper@example.test";
  const sensitiveGenerationMetadataValues = [
    "qa-revised-prompt-with-user-context",
    "renderer stderr: failed while loading private stack",
    "/tmp/letters-card/private-source.json",
    "imagen-worker.internal",
    "codex-imagen --render --debug",
  ];
  const sensitiveGenerationMetadata = {
    revisedPrompt: sensitiveGenerationMetadataValues[0],
    error: sensitiveGenerationMetadataValues[1],
    sourcePath: sensitiveGenerationMetadataValues[2],
    host: sensitiveGenerationMetadataValues[3],
    cliCommand: sensitiveGenerationMetadataValues[4],
  };

  const contactLetter = await letters.createAnonymousLetter({
    locale: "ko",
    authorEmail,
    body: "제 연락처는 010-1234-5678 입니다. 직접 연락해 주세요.",
  });
  assert(contactLetter.ok === false && contactLetter.error === "contact-info-not-allowed", "letter bodies containing phone/contact info must be rejected before storage or delivery", contactLetter);

    const normalLetter = await letters.createAnonymousLetter({
    locale: "ko",
    category: "concern",
    shareVisibility: "unlisted",
    authorEmail,
    authorNickname: "익명",
    body: "요즘 마음이 무너질 때가 많아서 위로의 말씀을 함께 받고 싶습니다.",
  });
  await flushAsyncWork();
  assert(normalLetter.ok === true, "valid anonymous letter should be accepted", normalLetter);
  assert(typeof normalLetter.replyToken === "string" && normalLetter.replyToken.length > 20, "test-mode creation must return a one-time reply token for local QA");
  assert(normalLetter.bundle?.letter?.status === "matched", "non-crisis letter with a distinct configured recipient should be matched even when SMTP is skipped", normalLetter.bundle?.letter);
  assert(normalLetter.bundle?.delivery?.status === "skipped", "SMTP-disabled delivery should be recorded as skipped instead of attempting live mail", normalLetter.bundle?.delivery);
  assert(emailCalls.length === 1 && emailCalls[0].to === "declan@ponslink.com", "non-crisis dispatch should address the fixed master relay email as first fallback recipient", emailCalls);
  assertPublicBundleSanitized(normalLetter.bundle, "new letter", [authorEmail, "declan@ponslink.com"]);

  const storedAfterCreate = await readFile(process.env.LETTERS_DATA_FILE, "utf8");
  assert(!storedAfterCreate.includes(normalLetter.replyToken), "raw reply tokens must never be persisted; only replyTokenHash may be stored");

  const crisisLetter = await letters.createAnonymousLetter({
    locale: "ko",
    authorEmail: "crisis-author@example.test",
    body: "crisis self-harm 자해 생각 때문에 오늘 밤이 너무 위험합니다. 도와주세요.",
  });
  await flushAsyncWork();
  assert(crisisLetter.ok === true, "crisis letters should still be accepted for safe handling", crisisLetter);
  assert(crisisLetter.bundle?.letter?.status === "blocked", "crisis safety assessment must mark the public letter as blocked", crisisLetter.bundle?.letter);
  assert(crisisLetter.bundle?.delivery === undefined, "crisis letters must not create public delivery metadata", crisisLetter.bundle?.delivery);
  assert(emailCalls.length === 1, "crisis letters must not dispatch helper SMTP email", emailCalls);
  assertPublicBundleSanitized(crisisLetter.bundle, "crisis letter", ["crisis-author@example.test", helperEmail]);

  const invalidReply = await letters.createLetterAnswer({
    locale: "ko",
    token: normalLetter.replyToken,
    responderNickname: "도움이",
    body: "카카오톡으로 연락해 주세요. kakao id를 보내겠습니다.",
  });
  assert(invalidReply.ok === false && invalidReply.error === "contact-info-not-allowed", "reply bodies containing direct contact handles must be rejected before consuming the token", invalidReply);

  const invalidScriptureReply = await letters.createLetterAnswer({
    locale: "ko",
    token: normalLetter.replyToken,
    responderNickname: "도움이",
    body: "본문은 깨끗하지만 성구 칸으로 연락처를 숨기는 시도입니다.",
    scriptureRef: "email helper@example.test",
  });
  assert(invalidScriptureReply.ok === false && invalidScriptureReply.error === "contact-info-not-allowed", "reply scripture references containing contact info must be rejected before consuming the token", invalidScriptureReply);

    const answer = await letters.createLetterAnswer({
    locale: "ko",
    token: normalLetter.replyToken,
    responderNickname: "말씀친구",
    body: "혼자가 아니라는 것을 기억하세요. 오늘은 시편의 위로를 천천히 붙드시면 좋겠습니다.",
    scriptureRef: "시편 23:1",
  });
  await flushAsyncWork();
  assert(answer.ok === true, "valid reply should be accepted with the original reply token", answer);
  assert(typeof answer.readToken === "string" && answer.readToken.length > 20, "accepted replies must mint a read token for the author notification");
  assert(emailCalls.length === 2 && emailCalls[1].to === authorEmail, "accepted replies should notify only the original author", emailCalls);
  assert(emailCalls[1].text.includes(`/ko/letters/answer/${answer.readToken}`), "author notification must contain the tokenized answer URL");
  assert(answer.answerCard.scripture.reference === "시편 23:1", "answer card must store the responder-selected Scripture reference", answer.answerCard.scripture);
  assert(answer.answerCard.scripture.text.includes("추천 성구 본문 1"), "answer card must resolve the responder-selected Scripture text instead of reusing the original letter Scripture", answer.answerCard.scripture);
  assert(!answer.answerCard.scripture.text.includes("여호와는 나의 목자"), "custom reply Scripture text must not leak the original recommendation text when the responder picked a different verse", answer.answerCard.scripture);
  const questionImageResult = cardGenerationResults.get(normalLetter.bundle.card.id);
  const answerDriveImageUrl = cardGenerationResults.get(answer.answerCard.id)?.imageUrl;
  assert(questionImageResult === undefined, "question cards must not generate images before the relay runner writes a reply", { questionImageResult, cardGenerationCalls });
  assert(answerDriveImageUrl === expectedDriveCardImageSrc(answer.answerCard.id), "answer image generation stub must return a public Drive URL only after the reply is submitted", { answerDriveImageUrl });
  assertEmailHtmlContainsDesignedFallbackCard({
    label: "letter notification before relay reply",
    message: emailCalls[0],
    card: normalLetter.bundle.card,
    expectedCtaPath: `/ko/letters/reply/${normalLetter.replyToken}`,
    expectedCtaText: "답변과 성구 보내기",
    forbiddenValues: [authorEmail, helperEmail, "declan@ponslink.com", ...sensitiveGenerationMetadataValues, "SMTP env is not configured"],
  });
  assertEmailsUseReturnedDriveCardImageUrls([
    {
      label: "reply notification",
      message: emailCalls[1],
      card: answer.answerCard,
      cardId: answer.answerCard.id,
      locale: "ko",
      expectedImageUrl: answerDriveImageUrl,
      expectedAltText: answer.answerCard.title,
      expectedCtaPath: `/ko/letters/answer/${answer.readToken}`,
      expectedCtaText: "답변 카드 보기",
      expectedFallbackLabel: "텍스트로 읽기",
      forbiddenValues: [authorEmail, helperEmail, ...sensitiveGenerationMetadataValues, "SMTP env is not configured"],
    },
  ]);
  const storedAfterDriveImages = JSON.parse(await readFile(process.env.LETTERS_DATA_FILE, "utf8"));
  const storedQuestionCard = storedAfterDriveImages.cards.find((card) => card.id === normalLetter.bundle.card.id);
  const storedAnswerCard = storedAfterDriveImages.cards.find((card) => card.id === answer.answerCard.id);
  assert(storedQuestionCard?.generationStatus === "skipped" && storedQuestionCard.imageUrl === undefined, "stored question card must stay image-less until a reply exists", storedQuestionCard);
  assertCardsStoreReturnedDriveImageUrls(storedAfterDriveImages.cards, [
    { label: "answer card", cardId: answer.answerCard.id, expectedImageUrl: answerDriveImageUrl },
  ]);
  assert(letters.makeCardPageImageSrc(storedQuestionCard, "ko") === null, "reply page question card must render the non-image fallback before the relay answer is submitted", storedQuestionCard);
  assertCardPageImagesUseServerProxy(letters, [
    { label: "answer/share page answer card", card: storedAnswerCard, locale: "ko" },
  ]);
  assert(await letters.getStoredCardImageUrl(normalLetter.bundle.card.id) === null, "card image route must not resolve an image URL for question cards before a relay answer is submitted");
  assert(await letters.getStoredCardImageUrl(answer.answerCard.id) === answerDriveImageUrl, "card image route must resolve stored Drive image URLs for generated answer cards");
  assert(await letters.getStoredCardImageUrl("../bad-card-id") === null, "card image route lookup must reject unsafe card ids");
  await assertCardImageRouteProxiesStoredDriveImage();

  const fallbackAuthorEmail = "fallback-author@example.test";
  const fallbackLetter = await letters.createAnonymousLetter({
    locale: "ko",
    category: "concern",
    shareVisibility: "unlisted",
    authorEmail: fallbackAuthorEmail,
    body: `${IMAGE_FALLBACK_MARKER}: 이미지 생성이 실패해도 말씀과 답장 버튼이 담긴 카드형 이메일을 받아야 합니다.`,
  });
  await flushAsyncWork();
  assert(fallbackLetter.ok === true, "letter creation should still succeed without generating a pre-reply question image", fallbackLetter);
  const fallbackLetterImageResult = cardGenerationResults.get(fallbackLetter.bundle.card.id);
  assert(fallbackLetterImageResult === undefined, "image fallback letter fixture must not call the image generator for question cards", fallbackLetterImageResult);
  const fallbackEmailHtmlFailures = [];
  const fallbackLetterEmail = emailCalls.at(-1);
  try {
    assertEmailHtmlContainsDesignedFallbackCard({
      label: "image-missing letter notification",
      message: fallbackLetterEmail,
      card: fallbackLetter.bundle.card,
      expectedCtaPath: `/ko/letters/reply/${fallbackLetter.replyToken}`,
      expectedCtaText: "답변과 성구 보내기",
      forbiddenValues: [fallbackAuthorEmail, helperEmail, "declan@ponslink.com", ...IMAGE_FALLBACK_PROVIDER_ERRORS],
    });
  } catch (error) {
    fallbackEmailHtmlFailures.push(error.message);
  }

  const fallbackAnswer = await letters.createLetterAnswer({
    locale: "ko",
    token: fallbackLetter.replyToken,
    responderNickname: "말씀동행",
    body: `${IMAGE_FALLBACK_MARKER}: 이미지가 생략되어도 답장 카드의 말씀과 확인 버튼은 HTML 안에서 분명해야 합니다.`,
    scriptureRef: "시편 23:1",
  });
  await flushAsyncWork();
  assert(fallbackAnswer.ok === true, "answer creation should still succeed when image generation is skipped with no imageUrl", fallbackAnswer);
  const fallbackAnswerImageResult = cardGenerationResults.get(fallbackAnswer.answerCard.id);
  assert(fallbackAnswerImageResult?.status === "skipped" && fallbackAnswerImageResult.imageUrl === undefined, "image fallback answer fixture must simulate a skipped generator result with no imageUrl", fallbackAnswerImageResult);
  const fallbackAnswerEmail = emailCalls.at(-1);
  try {
    assertEmailHtmlContainsDesignedFallbackCard({
      label: "image-skipped answer notification",
      message: fallbackAnswerEmail,
      card: fallbackAnswer.answerCard,
      expectedCtaPath: `/ko/letters/answer/${fallbackAnswer.readToken}`,
      expectedCtaText: "답변 카드 보기",
      forbiddenValues: [fallbackAuthorEmail, helperEmail, "declan@ponslink.com", fallbackLetter.replyToken, ...IMAGE_FALLBACK_PROVIDER_ERRORS],
    });
  } catch (error) {
    fallbackEmailHtmlFailures.push(error.message);
  }
  assert(fallbackEmailHtmlFailures.length === 0, "image-missing letter and answer email HTML must keep designed scripture card blocks and privacy-safe CTAs", fallbackEmailHtmlFailures);

  const secondAnswer = await letters.createLetterAnswer({
    locale: "ko",
    token: normalLetter.replyToken,
    body: "이미 답장한 토큰으로 다시 보내려는 시도입니다.",
  });
  assert(secondAnswer.ok === false && secondAnswer.error === "already-answered", "reply tokens must be single-use after an accepted answer", secondAnswer);

  const wrongAnswerBundle = await letters.getAnswerBundle("not-a-real-read-token");
  assert(wrongAnswerBundle === null, "answer bundles must require the token that hashes to the stored readTokenHash");

  const answerBundle = await letters.getAnswerBundle(answer.readToken);
  assert(answerBundle?.answer?.id === answer.answer.id, "read token should resolve the accepted answer bundle");
  assertPublicBundleSanitized(answerBundle, "answer", [authorEmail, helperEmail]);

  const publicLetterAfterAnswer = await letters.getLetterBundle(normalLetter.bundle.letter.id);
  assert(publicLetterAfterAnswer?.answer?.id === answer.answer.id, "letter bundle should include the accepted answer without exposing private fields");
  assertPublicBundleSanitized(publicLetterAfterAnswer, "answered letter", [authorEmail, helperEmail]);

  const questionCardBundle = await letters.getCardBundle(normalLetter.bundle.card.id);
  assert(questionCardBundle?.requestedCard?.id === normalLetter.bundle.card.id, "public card lookup must resolve by question card id, not letter id", questionCardBundle);
  const legacyLetterCardBundle = await letters.getCardBundle(normalLetter.bundle.letter.id);
  assert(legacyLetterCardBundle?.requestedCard?.id === normalLetter.bundle.card.id, "public card lookup should keep existing letter-id links resolving to the question card", legacyLetterCardBundle);
  const answerCardBundle = await letters.getCardBundle(answer.answerCard.id);
  assert(answerCardBundle?.requestedCard?.id === answer.answerCard.id && answerCardBundle.requestedCard.kind === "answer", "public card lookup must resolve answer card ids", answerCardBundle);

  const storedWithSensitiveMetadata = JSON.parse(await readFile(process.env.LETTERS_DATA_FILE, "utf8"));
  for (const card of storedWithSensitiveMetadata.cards) {
    if (card.id === normalLetter.bundle.card.id || card.id === answer.answerCard.id) {
      card.generationMetadata = { ...sensitiveGenerationMetadata, storedCardKind: card.kind };
    }
  }
  await writeFile(process.env.LETTERS_DATA_FILE, JSON.stringify(storedWithSensitiveMetadata, null, 2));

  const metadataLetterBundle = await letters.getLetterBundle(normalLetter.bundle.letter.id);
  assertNoGenerationMetadata(metadataLetterBundle, "letter bundle with stored question and answer metadata", sensitiveGenerationMetadataValues);
  const metadataQuestionCardBundle = await letters.getCardBundle(normalLetter.bundle.card.id);
  assert(metadataQuestionCardBundle?.requestedCard?.id === normalLetter.bundle.card.id, "question card lookup must still resolve after stored metadata is added", metadataQuestionCardBundle);
  assertNoGenerationMetadata(metadataQuestionCardBundle, "question card bundle with stored metadata", sensitiveGenerationMetadataValues);
  const metadataAnswerCardBundle = await letters.getCardBundle(answer.answerCard.id);
  assert(metadataAnswerCardBundle?.requestedCard?.id === answer.answerCard.id && metadataAnswerCardBundle.requestedCard.kind === "answer", "answer card lookup must still resolve after stored metadata is added", metadataAnswerCardBundle);
  assertNoGenerationMetadata(metadataAnswerCardBundle, "answer card bundle with stored metadata", sensitiveGenerationMetadataValues);
  const metadataAnswerBundle = await letters.getAnswerBundle(answer.readToken);
  assertNoGenerationMetadata(metadataAnswerBundle, "answer bundle with stored question and answer metadata", sensitiveGenerationMetadataValues);
  await letters.updateCardVisibility(answer.answerCard.id, "private");
  const privateAnswerCardBundle = await letters.getCardBundle(answer.answerCard.id);
  assert(privateAnswerCardBundle === null, "bare public card lookup must not return private cards", privateAnswerCardBundle);
  const questionAfterPrivateAnswer = await letters.getCardBundle(normalLetter.bundle.card.id);
  assert(questionAfterPrivateAnswer?.answer === undefined && questionAfterPrivateAnswer?.answerCard === null, "question card bundles must not expose a related private answer card or answer body", questionAfterPrivateAnswer);

  const storedAfterAnswer = await readFile(process.env.LETTERS_DATA_FILE, "utf8");
  assert(!storedAfterAnswer.includes(normalLetter.replyToken), "raw reply token must remain absent after answering");
  assert(!storedAfterAnswer.includes(answer.readToken), "raw answer read token must never be persisted; only readTokenHash may be stored");

  const deferLocaleRegressionDispatch = () => undefined;
  const englishKoRouteLetter = await letters.createAnonymousLetter({
    locale: "ko",
    acceptLanguage: "en-US,en;q=0.9",
    countryCode: "US",
    category: "concern",
    shareVisibility: "unlisted",
    authorEmail: "locale-route-author-en@example.test",
    body: `${MIC_PROMPT_MARKER}: I want to do justice, love mercy, and walk humbly today.`,
    scheduleDispatch: deferLocaleRegressionDispatch,
  });
  assert(englishKoRouteLetter.ok === true, "non-Korean browser/country on a /ko route should still create the letter", englishKoRouteLetter);
  assert(englishKoRouteLetter.bundle?.letter?.locale === "en", "non-Korean browser/country on a /ko route must select English as the letter locale", englishKoRouteLetter.bundle?.letter);
  assertLocalizedMicahCard(englishKoRouteLetter.bundle?.card, "non-Korean /ko route letter", {
    locale: "en",
    title: "Anonymous Concern",
    reference: "Micah 6:8",
  });

  const englishKoRouteAnswer = await letters.createLetterAnswer({
    locale: "ko",
    token: englishKoRouteLetter.replyToken,
    acceptLanguage: "en-US,en;q=0.9",
    countryCode: "US",
    body: `${MIC_PROMPT_MARKER}: A grounded answer should stay in English for this non-Korean request context.`,
  });
  assert(englishKoRouteAnswer.ok === true, "non-Korean browser/country on a /ko route should still accept the answer", englishKoRouteAnswer);
  assertLocalizedMicahCard(englishKoRouteAnswer.answerCard, "non-Korean /ko route answer", {
    locale: "en",
    title: "Anonymous reply",
    reference: "Micah 6:8",
  });
  assert(emailCalls.at(-1)?.text.includes(`/en/letters/answer/${englishKoRouteAnswer.readToken}`), "non-Korean /ko route answer email must use the selected English answer URL", emailCalls.at(-1));

  const koreanCountryLetter = await letters.createAnonymousLetter({
    locale: "en",
    acceptLanguage: "en-US,en;q=0.9",
    countryCode: "KR",
    category: "concern",
    shareVisibility: "unlisted",
    authorEmail: "locale-country-author-ko@example.test",
    body: `${MIC_PROMPT_MARKER}: I want to practice justice, mercy, and humility while visiting Korea.`,
    scheduleDispatch: deferLocaleRegressionDispatch,
  });
  assert(koreanCountryLetter.ok === true, "KR country requests should still create the letter", koreanCountryLetter);
  assert(koreanCountryLetter.bundle?.letter?.locale === "ko", "KR country must select Korean as the letter locale", koreanCountryLetter.bundle?.letter);
  assertLocalizedMicahCard(koreanCountryLetter.bundle?.card, "KR country letter", {
    locale: "ko",
    title: "익명의 고민",
    reference: "미가 6:8",
  });

  const koreanLanguageLetter = await letters.createAnonymousLetter({
    locale: "en",
    acceptLanguage: "ko-KR,ko;q=0.9,en;q=0.5",
    category: "concern",
    shareVisibility: "unlisted",
    authorEmail: "locale-browser-author-ko@example.test",
    body: `${MIC_PROMPT_MARKER}: The browser primary language should choose Korean when request country is not provided.`,
    scheduleDispatch: deferLocaleRegressionDispatch,
  });
  assert(koreanLanguageLetter.ok === true, "Korean browser language requests should still create the letter", koreanLanguageLetter);
  assert(koreanLanguageLetter.bundle?.letter?.locale === "ko", "Korean primary browser language must select Korean as the letter locale", koreanLanguageLetter.bundle?.letter);
  assertLocalizedMicahCard(koreanLanguageLetter.bundle?.card, "Korean browser language letter", {
    locale: "ko",
    title: "익명의 고민",
    reference: "미가 6:8",
  });

  const koreanLanguageAnswer = await letters.createLetterAnswer({
    locale: "en",
    token: koreanLanguageLetter.replyToken,
    acceptLanguage: "ko-KR,ko;q=0.9,en;q=0.5",
    body: `${MIC_PROMPT_MARKER}: 브라우저 언어가 한국어이면 답장 카드와 링크도 한국어여야 합니다.`,
  });
  assert(koreanLanguageAnswer.ok === true, "Korean browser language requests should still accept the answer", koreanLanguageAnswer);
  assertLocalizedMicahCard(koreanLanguageAnswer.answerCard, "Korean browser language answer", {
    locale: "ko",
    title: "익명의 답장",
    reference: "미가 6:8",
  });
  assert(emailCalls.at(-1)?.text.includes(`/ko/letters/answer/${koreanLanguageAnswer.readToken}`), "Korean browser language answer email must use the selected Korean answer URL", emailCalls.at(-1));
  assert(typeof koreanLanguageAnswer.answer?.responderNickname === "string" && koreanLanguageAnswer.answer.responderNickname.length > 0, "blank responder nickname should be replaced with a cute random nickname", koreanLanguageAnswer.answer);

  const participantEmail = "participant@example.test";
  const participantOtpRequest = await letters.requestLetterParticipantOtp({
    locale: "ko",
    email: participantEmail,
    nickname: "말씀동행",
    canReceiveLetters: true,
    preferredLocale: "ko",
    maxLettersPerDay: 1,
  });
  assert(participantOtpRequest.ok === true, "participant OTP request should send a verification email", participantOtpRequest);
  const otpMessage = emailCalls.at(-1);
  assert(otpMessage?.to === participantEmail, "participant OTP email should be addressed only to the joining email", otpMessage);
  const otpMatch = `${otpMessage.text}\n${otpMessage.html}`.match(/\b\d{6}\b/);
  assert(otpMatch, "participant OTP email should contain a six-digit code");
  const verifiedParticipant = await letters.verifyLetterParticipantOtp({ email: participantEmail, otp: otpMatch[0] });
  assert(verifiedParticipant.ok === true, "participant OTP verify should activate the participant", verifiedParticipant);
  assert(verifiedParticipant.participant?.canReceiveLetters === true, "verified opt-in participant should be eligible to receive letters", verifiedParticipant);
  assert(!JSON.stringify(verifiedParticipant).includes(participantEmail), "participant API response must expose only masked email, not raw email", verifiedParticipant);
  assert(typeof verifiedParticipant.sessionToken === "string" && verifiedParticipant.sessionToken.length > 20, "OTP verify should mint a participant session token for the route cookie");
  const storedAfterVerify = await readFile(process.env.LETTERS_DATA_FILE, "utf8");
  assert(!storedAfterVerify.includes(verifiedParticipant.sessionToken), "raw participant session token must not be persisted");
  const sessionParticipant = await letters.getLetterParticipantSession(verifiedParticipant.sessionToken);
  assert(sessionParticipant?.participantId === verifiedParticipant.participant.participantId, "session token should resolve the verified participant public status", sessionParticipant);
  const sessionAuthor = await letters.getLetterParticipantAuthor(verifiedParticipant.sessionToken);
  assert(sessionAuthor?.email === participantEmail, "session token should resolve the server-only participant author email", sessionAuthor);
  assert(!JSON.stringify(sessionParticipant).includes(participantEmail), "session public status must not expose raw email", sessionParticipant);
  const pausedSettings = await letters.updateLetterParticipantSettings({
    sessionToken: verifiedParticipant.sessionToken,
    nickname: "잠시쉼",
    canReceiveLetters: false,
    pauseDays: 7,
    preferredLocale: "en",
    maxLettersPerDay: 2,
  });
  assert(pausedSettings.ok === true && pausedSettings.participant.status === "paused" && pausedSettings.participant.canReceiveLetters === false && pausedSettings.participant.preferredLocale === "en" && pausedSettings.participant.maxLettersPerDay === 2, "settings update should support pause, locale preference, and receiving cap", pausedSettings);
  const resumedSettings = await letters.updateLetterParticipantSettings({
    sessionToken: verifiedParticipant.sessionToken,
    nickname: "말씀동행",
    canReceiveLetters: true,
    pauseDays: 0,
    preferredLocale: "ko",
    maxLettersPerDay: 1,
  });
  assert(resumedSettings.ok === true && resumedSettings.participant.status === "active" && resumedSettings.participant.canReceiveLetters === true && resumedSettings.participant.selectionLimitPerDay === 1, "settings update should resume receiving with the configured cap", resumedSettings);

  const blankNicknameSettings = await letters.updateLetterParticipantSettings({
    sessionToken: verifiedParticipant.sessionToken,
    nickname: "",
  });
  assert(blankNicknameSettings.ok === true && typeof blankNicknameSettings.participant.nickname === "string" && blankNicknameSettings.participant.nickname.length > 0, "blank participant nickname should be replaced with a cute random nickname", blankNicknameSettings);
  await letters.updateLetterParticipantSettings({
    sessionToken: verifiedParticipant.sessionToken,
    nickname: "말씀동행",
  });

    const participantMatchedLetter = await letters.createAnonymousLetter({
    locale: "ko",
    category: "question",
    shareVisibility: "unlisted",
    authorEmail: "participant-author@example.test",
    body: "참여자 랜덤 수신 풀이 실제로 우선 선택되는지 확인하는 테스트 편지입니다.",
  });
  await flushAsyncWork();
  assert(participantMatchedLetter.ok === true, "letter creation should still succeed with an active participant recipient", participantMatchedLetter);
  assert(emailCalls.at(-1)?.to === participantEmail, "active opted-in participant should be selected before env fallback recipients", emailCalls.at(-1));
  assert(participantMatchedLetter.bundle?.delivery?.status === "sent", "participant delivery should be recorded in the public bundle without exposing recipient identity", participantMatchedLetter.bundle?.delivery);
  assertPublicBundleSanitized(participantMatchedLetter.bundle, "participant-matched letter", ["participant-author@example.test", participantEmail, helperEmail]);
  const participantDeliveryEmail = emailCalls.at(-1);
  const participantAuthoredLetter = await letters.createAnonymousLetter({
    locale: "ko",
    category: "reflection",
    shareVisibility: "unlisted",
    authorEmail: participantEmail,
    body: "참여자가 직접 작성한 말씀편지는 내 편지함에서 다시 확인할 수 있어야 합니다.",
  });
  await flushAsyncWork();
  assert(participantAuthoredLetter.ok === true, "participant-authored letter should be created before history lookup", participantAuthoredLetter);
  assert(typeof participantAuthoredLetter.bundle?.letter?.authorNickname === "string" && participantAuthoredLetter.bundle.letter.authorNickname.length > 0, "blank author nickname should be replaced with a cute random nickname", participantAuthoredLetter.bundle?.letter);
  const participantHistory = await letters.getLetterParticipantHistory(verifiedParticipant.sessionToken);
  assert(participantHistory?.authored.some((item) => item.letter.id === participantAuthoredLetter.bundle.letter.id), "participant history should include letters authored by the verified participant", participantHistory);
  assert(participantHistory?.received.some((item) => item.letter.id === participantMatchedLetter.bundle.letter.id), "participant history should include letters delivered to the verified participant", participantHistory);
  assert(!JSON.stringify(participantHistory).includes(participantEmail), "participant history must not expose raw participant email", participantHistory);

  // Relay contract: scripture stripped from public bundles for author view
  const authorBundle = await letters.getLetterBundle(normalLetter.bundle.letter.id);
  assert(authorBundle?.letter.scripture.reference === "", "public letter bundle must strip scripture recommendation from author view", authorBundle?.letter.scripture);

  // Relay contract: reply bundle includes scripture for relay runner
  const runnerBundle = await letters.getReplyBundle(normalLetter.replyToken);
  assert(runnerBundle?.scriptureRecommendations?.length === 10, "reply bundle must include up to ten scripture recommendations for relay runner", runnerBundle?.scriptureRecommendations);
  assert(new Set(runnerBundle.scriptureRecommendations.map((suggestion) => suggestion.reference)).size === runnerBundle.scriptureRecommendations.length, "reply bundle scripture recommendations must be de-duplicated by reference", runnerBundle.scriptureRecommendations);
  assert(runnerBundle.scriptureRecommendations[0]?.reference === normalLetter.bundle.card.scripture.reference, "reply bundle must keep the original system-selected scripture as the first recommendation", runnerBundle.scriptureRecommendations);
  assert(runnerBundle?.letter.scripture.reference.length > 0, "reply bundle letter must include scripture for relay runner", runnerBundle?.letter.scripture);
  const routeSuggestions = await letters.suggestReplyScriptures(normalLetter.replyToken);
  assert(routeSuggestions.ok === true && routeSuggestions.suggestions.length === 10, "reply suggestion API contract must return the same capped ten scripture options", routeSuggestions);
  const relatedRunnerSuggestion = runnerBundle.scriptureRecommendations.find((suggestion) => suggestion.reference.includes("23:5"));
  assert(relatedRunnerSuggestion && relatedRunnerSuggestion.reason === "" && !relatedRunnerSuggestion.text.includes("추천 이유") && !relatedRunnerSuggestion.text.includes("메인 성구"), "relay runner related scripture suggestions must carry only scripture text, not explanatory helper copy", relatedRunnerSuggestion);

  // Relay contract: accept relay participation
  const relayResult = await letters.acceptRelayParticipation(verifiedParticipant.sessionToken);
  assert(relayResult.ok === true && relayResult.participant.canReceiveLetters === true, "relay accept must set canReceiveLetters through session token", relayResult);
  const unsubscribeMatch = `${participantDeliveryEmail?.text}\n${participantDeliveryEmail?.html}`.match(/\/letters\/unsubscribe\/([A-Za-z0-9_-]+)/);
  assert(unsubscribeMatch, "participant delivery email should include an unsubscribe token link", participantDeliveryEmail);
  const rawUnsubscribeToken = unsubscribeMatch[1];
  const storedAfterDelivery = await readFile(process.env.LETTERS_DATA_FILE, "utf8");
  assert(!storedAfterDelivery.includes(rawUnsubscribeToken), "raw unsubscribe token must not be persisted");
  assert(!storedAfterDelivery.includes(participantEmail) && !storedAfterDelivery.includes("participant-author@example.test") && !storedAfterDelivery.includes(helperEmail), "configured email encryption should keep raw stored letter emails out of the data file", storedAfterDelivery);
  const unsubscribedByToken = await letters.unsubscribeLetterParticipant({ token: rawUnsubscribeToken });
  assert(unsubscribedByToken.ok === true && unsubscribedByToken.participant.status === "unsubscribed" && unsubscribedByToken.participant.canReceiveLetters === false, "unsubscribe token should remove participant from receiving pool", unsubscribedByToken);
  const sessionAfterUnsubscribe = await letters.getLetterParticipantSession(verifiedParticipant.sessionToken);
  assert(sessionAfterUnsubscribe === null, "unsubscribe should invalidate the participant session token");

    const participantSelfLetter = await letters.createAnonymousLetter({
    locale: "ko",
    category: "reflection",
    shareVisibility: "unlisted",
    authorEmail: participantEmail,
    body: "내가 작성자인 경우에는 내 이메일이 랜덤 수신자로 다시 선택되지 않아야 합니다.",
  });
  await flushAsyncWork();
  assert(participantSelfLetter.ok === true, "letter creation should succeed when author is also a participant", participantSelfLetter);
  assert(emailCalls.at(-1)?.to === "declan@ponslink.com", "author participant must be excluded from recipient selection and fall back to the fixed master relay email when no other participant is eligible", emailCalls.at(-1));
  assertPublicBundleSanitized(participantSelfLetter.bundle, "participant self-exclusion letter", [participantEmail, "declan@ponslink.com"]);
  const relayAvailabilityForOnlyAuthor = await letters.getRelayAvailability(participantEmail);
  assert(relayAvailabilityForOnlyAuthor.hasEligibleHumanRelay === false && relayAvailabilityForOnlyAuthor.usesMasterFallback === true, "relay availability should ask for more light bearers when only the author is registered", relayAvailabilityForOnlyAuthor);


  let remoteExecCount = 0;
  const disabledCardGenerator = loadTsModule("lib/letter-card-generator.ts", {
    "node:child_process": {
      execFile: (...args) => {
        remoteExecCount += 1;
        throw new Error(`remote image command should be disabled during QA: ${JSON.stringify(args)}`);
      },
    },
    "@/lib/google-drive": {
      letterCardDriveFolderId: () => {
        throw new Error("disabled Imagen fallback must not resolve a Drive folder");
      },
      uploadLetterCardImage: async () => {
        throw new Error("disabled Imagen fallback must not upload to Drive");
      },
    },
  });
  const fallback = await disabledCardGenerator.queueCardImageGeneration({
    id: "card-disabled",
    title: "위로의 말씀",
    scripture: { reference: "시편 23:1", text: "여호와는 나의 목자시니", reason: "comfort", href: "/ko/bible/PSA.23.1", confidence: 0.9 },
    visualTheme: { tone: "warm", palette: ["#111111", "#ffffff"], symbols: ["shepherd"], layoutHint: "square" },
  }, { body: "이미지 생성 비활성화 확인", locale: "ko" });
  assert(fallback.status === "skipped", "Codex Imagen must return a skipped fallback when LETTERS_ENABLE_CODEX_IMAGEN is not enabled", fallback);
  assert(fallback.metadata?.provider === "codex-imagen", "disabled Imagen fallback must preserve provider metadata", fallback);
  assert(typeof fallback.metadata?.reason === "string" && fallback.metadata.reason.includes("LETTERS_ENABLE_CODEX_IMAGEN"), "disabled Imagen fallback must explain the enabling env flag", fallback);
  assert(remoteExecCount === 0, "disabled Imagen fallback must not call ssh or the Codex Imagen CLI", { remoteExecCount });

  const driveEnv = {
    LETTERS_N8N_IMAGE_UPLOAD_URL: process.env.LETTERS_N8N_IMAGE_UPLOAD_URL,
    LETTERS_CARD_IMAGE_UPLOAD_WEBHOOK_URL: process.env.LETTERS_CARD_IMAGE_UPLOAD_WEBHOOK_URL,
    LETTERS_N8N_IMAGE_UPLOAD_TOKEN: process.env.LETTERS_N8N_IMAGE_UPLOAD_TOKEN,
    LETTERS_GOOGLE_DRIVE_REFRESH_TOKEN: process.env.LETTERS_GOOGLE_DRIVE_REFRESH_TOKEN,
    GOOGLE_DRIVE_REFRESH_TOKEN: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    LETTERS_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: process.env.LETTERS_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON,
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    LETTERS_GOOGLE_DRIVE_CLIENT_EMAIL: process.env.LETTERS_GOOGLE_DRIVE_CLIENT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    LETTERS_GOOGLE_DRIVE_PRIVATE_KEY: process.env.LETTERS_GOOGLE_DRIVE_PRIVATE_KEY,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  };
  const restoreDriveEnv = () => {
    for (const [key, value] of Object.entries(driveEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
  try {
    const n8nFetchCalls = [];
    const n8nUploadUrl = "https://n8n.ponslink.test/webhook/letter-card-upload-secret";
    process.env.LETTERS_N8N_IMAGE_UPLOAD_URL = n8nUploadUrl;
    process.env.LETTERS_N8N_IMAGE_UPLOAD_TOKEN = "qa-n8n-token";
    delete process.env.LETTERS_CARD_IMAGE_UPLOAD_WEBHOOK_URL;
    delete process.env.LETTERS_GOOGLE_DRIVE_REFRESH_TOKEN;
    delete process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    delete process.env.LETTERS_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.LETTERS_GOOGLE_DRIVE_CLIENT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.LETTERS_GOOGLE_DRIVE_PRIVATE_KEY;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options = {}) => {
      n8nFetchCalls.push({ url, options });
      assert(url === n8nUploadUrl, "n8n Drive upload must use the configured webhook URL", { url });
      assert(options.method === "POST", "n8n Drive upload must POST generated image data", options);
      assert(options.headers?.authorization === "Bearer qa-n8n-token", "n8n Drive upload must forward optional webhook bearer token", options.headers);
      assert(options.body instanceof FormData, "n8n Drive upload must send multipart form data", { bodyType: options.body?.constructor?.name });
      assert(options.body.get("fileName") === "card-n8n.png", "n8n Drive upload must include generated file name", { value: options.body.get("fileName") });
      assert(options.body.get("mimeType") === "image/png", "n8n Drive upload must include generated MIME type", { value: options.body.get("mimeType") });
      assert(options.body.get("folderId") === "qa-n8n-folder", "n8n Drive upload must include the selected Drive folder id", { value: options.body.get("folderId") });
      assert(options.body.get("data") instanceof Blob, "n8n Drive upload must include the image binary field named data", { value: options.body.get("data")?.constructor?.name });
      return Response.json({ id: "qa-n8n-file", imageUrl: "https://drive.google.com/uc?export=view&id=qa-n8n-file" });
    };
    try {
      const drive = loadTsModule("lib/google-drive.ts", {
        "node:fs/promises": {
          readFile: async (path) => {
            assert(path === "/tmp/card-n8n.png", "n8n Drive upload must read the generated local image path", { path });
            return Buffer.from("png-bytes");
          },
        },
      });
      assert(drive.isLetterCardDriveConfigured() === true, "n8n upload webhook env must satisfy Drive image storage configuration");
      const n8nUpload = await drive.uploadLetterCardImage({
        localPath: "/tmp/card-n8n.png",
        fileName: "card-n8n.png",
        folderId: "qa-n8n-folder",
        mimeType: "image/png",
      });
      assert(n8nUpload.ok === true && n8nUpload.fileId === "qa-n8n-file", "n8n Drive upload must return the webhook file id", n8nUpload);
      assert(n8nUpload.imageUrl === "https://drive.google.com/uc?export=view&id=qa-n8n-file", "n8n Drive upload must return the webhook public image URL", n8nUpload);
      assert(n8nFetchCalls.length === 1, "n8n Drive upload must call the webhook exactly once", n8nFetchCalls);
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    restoreDriveEnv();
  }

  const enabledImagenEnv = {
    LETTERS_ENABLE_CODEX_IMAGEN: process.env.LETTERS_ENABLE_CODEX_IMAGEN,
    LETTERS_CODEX_IMAGEN_BIN: process.env.LETTERS_CODEX_IMAGEN_BIN,
    LETTERS_CODEX_IMAGEN_HOST: process.env.LETTERS_CODEX_IMAGEN_HOST,
    LETTERS_CODEX_IMAGEN_LOCAL: process.env.LETTERS_CODEX_IMAGEN_LOCAL,
    LETTERS_CODEX_IMAGEN_MODEL: process.env.LETTERS_CODEX_IMAGEN_MODEL,
    LETTERS_CARD_PROMPT_DIR: process.env.LETTERS_CARD_PROMPT_DIR,
    LETTERS_CARD_OUTPUT_DIR: process.env.LETTERS_CARD_OUTPUT_DIR,
    [LETTER_CARD_DRIVE_FOLDER_ENV]: process.env[LETTER_CARD_DRIVE_FOLDER_ENV],
  };
  const restoreEnabledImagenEnv = () => {
    for (const [key, value] of Object.entries(enabledImagenEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
  try {
    const enabledCardId = "card-enabled";
    const imagenHost = "qa-imagen-host";
    const imagenCli = "/qa/bin/codex-imagen";
    const promptDir = join(tempDir, "imagen-prompts");
    const outputDir = join(tempDir, "imagen-output");
    const localPromptPath = join(promptDir, `${enabledCardId}.prompt.txt`);
    const localOutputPath = join(outputDir, `${enabledCardId}.png`);
    const remoteDir = `/tmp/bible-letters-codex-imagen/${enabledCardId}`;
    const remotePromptPath = `${remoteDir}/prompt.txt`;
    const remoteOutputPath = `${remoteDir}/output.png`;
    const driveFolderId = "qa-drive-folder-override";
    const drivePublicImageUrl = expectedDriveCardImageSrc(enabledCardId);
    const localFiles = new Set();
    const remoteFiles = new Set();
    const execCalls = [];
    const driveUploads = [];

    process.env.LETTERS_ENABLE_CODEX_IMAGEN = "1";
    process.env.LETTERS_CODEX_IMAGEN_HOST = imagenHost;
    process.env.LETTERS_CODEX_IMAGEN_BIN = imagenCli;
    process.env.LETTERS_CODEX_IMAGEN_MODEL = "qa-model";
    process.env.LETTERS_CARD_PROMPT_DIR = promptDir;
    process.env.LETTERS_CARD_OUTPUT_DIR = outputDir;
    process.env[LETTER_CARD_DRIVE_FOLDER_ENV] = driveFolderId;
    delete process.env.LETTERS_CODEX_IMAGEN_LOCAL;

    const execFileStub = (command, args, options, callback) => {
      const done = typeof options === "function" ? options : callback;
      execCalls.push({ command, args });
      try {
        let stdout = "";
        if (command === "ssh") {
          assert(args[0] === imagenHost, "Codex Imagen remote shell must target the configured adapter host", { args });
          const shellCommand = args[1];
          if (shellCommand.includes("mkdir -p") && shellCommand.includes(remoteDir)) {
            stdout = "";
          } else if (shellCommand.includes(imagenCli)) {
            assert(shellCommand.includes("--prompt-file") && shellCommand.includes(remotePromptPath), "Codex Imagen command must reference the remote prompt artifact", { shellCommand });
            assert(shellCommand.includes("--output") && shellCommand.includes(remoteOutputPath), "Codex Imagen command must reference the remote output artifact", { shellCommand });
            assert(remoteFiles.has(remotePromptPath), "Codex Imagen command must run after the prompt is copied to the remote host", { remoteFiles: [...remoteFiles] });
            remoteFiles.add(remoteOutputPath);
            stdout = JSON.stringify({
              model: "qa-model",
              images: [{ decodedPath: remoteOutputPath, sha256: "qa-sha256", revised_prompt: null }],
            });
          } else if (shellCommand.includes("rm -rf") && shellCommand.includes(remoteDir)) {
            for (const path of [...remoteFiles]) {
              if (path.startsWith(remoteDir)) remoteFiles.delete(path);
            }
          } else {
            assert(false, "unexpected Codex Imagen ssh command", { shellCommand });
          }
        } else if (command === "scp") {
          const source = args.at(-2);
          const destination = args.at(-1);
          if (source === localPromptPath && destination === `${imagenHost}:${remotePromptPath}`) {
            assert(localFiles.has(localPromptPath), "Codex Imagen prompt must be written locally before upload", { localFiles: [...localFiles] });
            remoteFiles.add(remotePromptPath);
          } else if (source === `${imagenHost}:${remoteOutputPath}` && destination === localOutputPath) {
            assert(remoteFiles.has(remoteOutputPath), "Codex Imagen output must exist remotely before download", { remoteFiles: [...remoteFiles] });
            localFiles.add(localOutputPath);
          } else {
            assert(false, "unexpected Codex Imagen scp command", { args });
          }
        } else {
          assert(false, "Codex Imagen must use ssh/scp adapter commands in QA", { command, args });
        }
        done(null, stdout, "");
      } catch (error) {
        done(error);
      }
    };
    execFileStub[Symbol.for("nodejs.util.promisify.custom")] = (command, args, options) => new Promise((resolve, reject) => {
      execFileStub(command, args, options, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });

    const uploadLetterCardImage = async ({ localPath, fileName, folderId, mimeType }) => {
      driveUploads.push({ localPath, fileName, folderId, mimeType });
      assert(localPath === localOutputPath, "Drive upload must receive the generated local output image path", { localPath, localOutputPath });
      assert(fileName === `${enabledCardId}.png`, "Drive upload must use the generated card image file name", { fileName });
      assert(folderId === driveFolderId, "Drive upload must honor the configured letters card Drive folder override", { folderId, driveFolderId, defaultFolderId: LETTER_CARD_DRIVE_FOLDER_ID });
      assert(mimeType === "image/png", "Drive upload must preserve the generated PNG MIME type", { mimeType });
      assert(localFiles.has(localOutputPath), "Drive upload must happen after the remote output is downloaded and before local output cleanup", { localOutputPath, localFiles: [...localFiles] });
      return { ok: true, imageUrl: drivePublicImageUrl, fileId: `qa-drive-${enabledCardId}` };
    };

    const enabledCardGenerator = loadTsModule("lib/letter-card-generator.ts", {
      "node:child_process": {
        execFile: execFileStub,
      },
      "node:fs/promises": {
        mkdir: async () => undefined,
        writeFile: async (path) => {
          localFiles.add(path);
        },
        copyFile: async () => {
          throw new Error("Codex Imagen QA should not use local copyFile when a remote host is configured");
        },
        rm: async (path) => {
          localFiles.delete(path);
        },
      },
      "@/lib/google-drive": {
        letterCardDriveFolderId: () => driveFolderId,
        isLetterCardDriveConfigured: () => true,
        uploadLetterCardImage,
      },
    });

    const ready = await enabledCardGenerator.queueCardImageGeneration({
      id: enabledCardId,
      letterId: "letter-enabled",
      kind: "question",
      title: "위로의 말씀",
      summary: "하나님의 돌보심을 기억합니다.",
      scripture: { reference: "시편 23:1", text: "여호와는 나의 목자시니 내게 부족함이 없으리로다", reason: "comfort", href: "/ko/bible/PSA.23.1", confidence: "high" },
      visualTheme: {
        coreMessage: "하나님은 양처럼 지친 마음을 돌보십니다.",
        spiritualTheme: "divine comfort",
        emotionalTone: "warm and peaceful",
        visualMetaphor: "a shepherd guiding one lamb through soft dawn light",
        environment: "quiet hillside at sunrise",
        includeHumanFigure: true,
      },
      generationProvider: "codex-imagen",
      generationStatus: "pending",
      visibility: "unlisted",
      createdAt: "2026-07-06T00:00:00.000Z",
    }, { body: "이미지 생성 성공 후 로컬 파일 정리 확인", locale: "ko" });

    assert(ready.status === "ready", "Codex Imagen enabled mode must return ready when the adapter reports a generated image", ready);
    assert(ready.imageUrl === drivePublicImageUrl, "Codex Imagen enabled mode must return the public Drive URL returned by uploadLetterCardImage", ready);
    assert(!String(ready.imageUrl).includes(`/api/letters/card/${enabledCardId}/image`), "Codex Imagen enabled mode must not return a persistent server image route for new generated images", ready);
    assert(driveUploads.length === 1, "Codex Imagen enabled mode must upload the generated local output image to Google Drive exactly once", driveUploads);
    assert(!localFiles.has(localPromptPath), "Codex Imagen enabled mode must remove the local prompt artifact after completion", { localPromptPath, localFiles: [...localFiles] });
    assert(!localFiles.has(localOutputPath), "Codex Imagen enabled mode must remove the local output image after Drive upload", { localOutputPath, localFiles: [...localFiles], driveUploads });
    assert(execCalls.some((call) => call.command === "ssh" && call.args[1].includes(imagenCli)), "Codex Imagen enabled mode must invoke the generator through the remote adapter command", execCalls);
    assert(execCalls.some((call) => call.command === "scp" && call.args.at(-1) === `${imagenHost}:${remotePromptPath}`), "Codex Imagen enabled mode must upload the local prompt through the adapter path", execCalls);
    assert(execCalls.some((call) => call.command === "scp" && call.args.at(-2) === `${imagenHost}:${remoteOutputPath}`), "Codex Imagen enabled mode must download the remote output through the adapter path before cleanup", execCalls);
  } finally {
    restoreEnabledImagenEnv();
  }

  const pendingCreate = {};
  pendingCreate.promise = new Promise((resolve) => {
    pendingCreate.resolve = resolve;
  });
  const letterRouteCalls = [];
  const scheduledLetterJobs = [];
  class LetterRouteNextResponse extends Response {
    static json(body, init) {
      return Response.json(body, init);
    }
  }
  const letterRoute = loadTsModule("app/[locale]/api/letters/route.ts", {
    "next/server": {
      NextResponse: LetterRouteNextResponse,
      after: (callback) => {
        scheduledLetterJobs.push(callback);
      },
    },
    "next/headers": {
      cookies: async () => ({ get: () => undefined }),
    },
    "@/lib/content": {
      resolveAppLocale: (locale) => (locale === "en" ? "en" : "ko"),
    },
    "@/lib/letters": {
      getLetterParticipantAuthor: async () => null,
      createAnonymousLetter: async (input) => {
        letterRouteCalls.push(input);
        await pendingCreate.promise;
        return {
          ok: true,
          replyToken: "route-reply-token-must-not-leak",
          bundle: {
            letter: { id: "route-letter-id", status: "matched" },
            card: { id: "route-card-id" },
          },
        };
      },
    },
  });
  const quickLetterResponsePromise = letterRoute.POST(new Request("https://bible.ponslink.test/ko/api/letters", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept-language": "ko-KR,ko;q=0.9",
      "x-vercel-ip-country": "KR",
    },
    body: JSON.stringify({
      body: "라우트는 카드 생성과 이메일 완료를 기다리지 않고 즉시 접수해야 합니다.",
      authorEmail: "route-author@example.test",
      authorNickname: "빠른접수",
      category: "concern",
      shareVisibility: "unlisted",
    }),
  }), { params: Promise.resolve({ locale: "ko" }) });
  const quickLetterRace = await Promise.race([
    quickLetterResponsePromise.then((response) => ({ type: "response", response })),
    flushAsyncWork().then(() => ({ type: "pending" })),
  ]);
  assert(quickLetterRace.type === "response", "/[locale]/api/letters POST must acknowledge before createAnonymousLetter/image/email work settles");
  const quickLetterResponse = quickLetterRace.response;
  const quickLetterJson = await quickLetterResponse.json();
  assert(quickLetterResponse.status === 202, "/[locale]/api/letters POST should return 202 Accepted for queued concern creation", quickLetterJson);
  assert(quickLetterJson.accepted === true, "/[locale]/api/letters POST should return accepted:true for queued concern creation", quickLetterJson);
  assert(!("bundle" in quickLetterJson) && !("letterId" in quickLetterJson) && !("cardId" in quickLetterJson) && !JSON.stringify(quickLetterJson).includes("route-reply-token-must-not-leak"), "/[locale]/api/letters POST must not serialize bundle/card identifiers or raw createAnonymousLetter internals", quickLetterJson);
  assert(letterRouteCalls.length === 0, "/[locale]/api/letters POST should schedule createAnonymousLetter after the acknowledgement instead of running it inline", letterRouteCalls);
  assert(scheduledLetterJobs.length === 1, "/[locale]/api/letters POST should schedule exactly one background createAnonymousLetter job", scheduledLetterJobs.length);
  const scheduledLetterWork = Promise.allSettled(scheduledLetterJobs.map((job) => job()));
  await flushAsyncWork();
  assert(letterRouteCalls.length === 1, "scheduled /[locale]/api/letters background job should eventually invoke createAnonymousLetter", letterRouteCalls);
  assert(letterRouteCalls[0]?.locale === "ko" && letterRouteCalls[0]?.category === "concern" && letterRouteCalls[0]?.authorEmail === "route-author@example.test", "scheduled /[locale]/api/letters job should pass the submitted concern fields into createAnonymousLetter", letterRouteCalls[0]);
  pendingCreate.resolve();
  const scheduledLetterResults = await scheduledLetterWork;
  assert(scheduledLetterResults.every((result) => result.status === "fulfilled"), "scheduled /[locale]/api/letters background createAnonymousLetter job should settle without throwing", scheduledLetterResults);

  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const formFetchCalls = [];
  let letterFormRenderState = { values: [], isPending: false };
  function formIcon(name) {
    const Component = () => ({ type: name, props: {} });
    Component.displayName = name;
    return Component;
  }
  function formElement(type, props) {
    return { type, props: props ?? {} };
  }
  function collectFormNodes(node, predicate, matches = []) {
    if (!node || typeof node !== "object") return matches;
    if (Array.isArray(node)) {
      node.forEach((child) => collectFormNodes(child, predicate, matches));
      return matches;
    }
    if (predicate(node)) matches.push(node);
    collectFormNodes(node.props?.children, predicate, matches);
    return matches;
  }
  function formText(node) {
    if (node === undefined || node === null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map((child) => formText(child)).join("");
    if (typeof node === "object") return formText(node.props?.children);
    return "";
  }
  try {
    const letterForms = loadTsModule("components/letter-forms.tsx", {
      "next/link": { default: (props) => formElement("a", props) },
      "react": {
        useState: (initial) => {
          const value = letterFormRenderState.values.length > 0 ? letterFormRenderState.values.shift() : initial;
          return [value, () => undefined];
        },
        useMemo: (factory) => factory(),
        useTransition: () => [
          letterFormRenderState.isPending,
          (callback) => callback(),
        ],
      },
      "react/jsx-runtime": {
        jsx: formElement,
        jsxs: formElement,
        Fragment: Symbol.for("react.fragment"),
      },
      "lucide-react": {
        CheckCircle2: formIcon("CheckCircle2"),
        Loader2: formIcon("Loader2"),
        Mail: formIcon("Mail"),
        Send: formIcon("Send"),
        ShieldCheck: formIcon("ShieldCheck"),
      },
    });
    letterFormRenderState = { values: ["This concern body is long enough to submit immediately.", "", "concern", null], isPending: false };
    globalThis.window = { location: { href: "about:blank" } };
    globalThis.fetch = (...args) => {
      formFetchCalls.push(args);
      return new Promise(() => undefined);
    };
    const writeForm = letterForms.LetterWriteForm({ locale: "ko", authorEmail: "form-author@example.test" });
    const [writeFormNode] = collectFormNodes(writeForm, (node) => node.type === "form");
    assert(typeof writeFormNode?.props?.onSubmit === "function", "LetterWriteForm should expose a submit handler on its form element");
    writeFormNode.props.onSubmit({ preventDefault: () => undefined });
    assert(formFetchCalls.length === 1, "LetterWriteForm submit should start the concern POST request", formFetchCalls);
    assert(globalThis.window.location.href === "/ko/letters/sent", "LetterWriteForm should navigate to the sent page immediately after starting the concern POST request", { href: globalThis.window.location.href, formFetchCalls });

    letterFormRenderState = { values: ["This concern body is long enough to keep the submit button enabled.", "", "concern", null], isPending: true };
    const pendingWriteForm = letterForms.LetterWriteForm({ locale: "ko", authorEmail: "form-author@example.test" });
    const [submitButton] = collectFormNodes(pendingWriteForm, (node) => node.type === "button" && node.props?.type === "submit");
    assert(submitButton?.props?.disabled !== true, "LetterWriteForm submit button should not be disabled only because a concern POST is pending", submitButton?.props);
    const pendingIcons = collectFormNodes(submitButton, (node) => typeof node.type === "function").map((node) => node.type.displayName ?? node.type.name);
    assert(!pendingIcons.includes("Loader2") && pendingIcons.includes("Send"), "LetterWriteForm submit button should not render a pending spinner for quick concern submission", pendingIcons);

    letterFormRenderState = { values: ["답변 본문은 충분한 길이입니다.", "", "시편 23:1", 0, "suggested", null], isPending: false };
    const replyForm = letterForms.LetterReplyForm({
      locale: "ko",
      token: "form-reply-token",
      defaultScripture: "시편 23:1",
      scriptureSuggestions: [
        { reference: "시편 23:1", text: "여호와는 나의 목자시니", reason: "돌보심", href: "/ko/bible/PSA.23.1", confidence: "high" },
        { reference: "미가 6:8", text: "오직 공의를 행하며", reason: "공의와 인자", href: "/ko/bible/MIC.6.8", confidence: "medium" },
      ],
    });
    const replyText = formText(replyForm);
    assert(replyText.includes("추천 중 선택") && replyText.includes("직접 입력") && replyText.includes("1/2") && replyText.includes("다음"), "LetterReplyForm must render suggested/custom scripture controls and slide navigation", replyText);
    assert(!replyText.includes("high") && !replyText.includes("돌보심"), "LetterReplyForm suggested scripture card must hide confidence and explanatory reason copy", replyText);
    const scriptureDots = collectFormNodes(replyForm, (node) => node.type === "button" && typeof node.props?.["aria-label"] === "string" && node.props["aria-label"].includes("추천 성구 선택"));
    assert(scriptureDots.length === 2, "LetterReplyForm must render one slide selector per scripture suggestion", scriptureDots.map((node) => node.props?.["aria-label"]));

    const quickSessionStorage = () => {
      const store = new Map();
      return {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        _store: store,
      };
    };
    let quickRenderState = { values: [], isPending: false };
    let quickSessionState = { status: "unauthenticated", data: null };
    const quickTransitionPromises = [];
    const quickSignInCalls = [];
    const quickFetchCalls = [];
    const quickSend = loadTsModule("components/letter-quick-send-form.tsx", {
      "next-auth/react": {
        useSession: () => quickSessionState,
        signIn: (...args) => {
          quickSignInCalls.push(args);
          return Promise.resolve();
        },
      },
      "react": {
        useState: (initial) => {
          const value = quickRenderState.values.length > 0 ? quickRenderState.values.shift() : initial;
          return [value, () => undefined];
        },
        useMemo: (factory) => factory(),
        useCallback: (callback) => callback,
        useRef: (initial) => ({ current: initial }),
        useEffect: (effect) => effect(),
        useTransition: () => [
          quickRenderState.isPending,
          (callback) => {
            const result = callback();
            quickTransitionPromises.push(result);
            return result;
          },
        ],
      },
      "react/jsx-runtime": {
        jsx: formElement,
        jsxs: formElement,
        Fragment: Symbol.for("react.fragment"),
      },
      "lucide-react": {
        Loader2: formIcon("Loader2"),
        Send: formIcon("Send"),
      },
    });

    const unauthenticatedStorage = quickSessionStorage();
    globalThis.window = { location: { href: "about:blank" }, sessionStorage: unauthenticatedStorage };
    globalThis.fetch = (...args) => {
      quickFetchCalls.push(args);
      return Promise.resolve(Response.json({ ok: true }, { status: 202 }));
    };
    quickRenderState = { values: ["로그인 전에 작성한 고민은 충분한 길이를 갖습니다.", null], isPending: false };
    quickSessionState = { status: "unauthenticated", data: null };
    const unauthenticatedQuickForm = quickSend.LetterQuickSendForm({ locale: "ko" });
    const [unauthenticatedQuickFormNode] = collectFormNodes(unauthenticatedQuickForm, (node) => node.type === "form");
    unauthenticatedQuickFormNode.props.onSubmit({ preventDefault: () => undefined });
    assert(quickSignInCalls.length === 1 && quickSignInCalls[0][0] === "google" && quickSignInCalls[0][1]?.callbackUrl === "/ko/letters", "LetterQuickSendForm must route unauthenticated sends through Google sign-in with the letters callback", quickSignInCalls);
    assert(unauthenticatedStorage.getItem("letters.pendingConcern.ko")?.includes("로그인 전에 작성한 고민"), "LetterQuickSendForm must preserve the pending concern before sign-in", unauthenticatedStorage._store);
    assert(quickFetchCalls.length === 0, "LetterQuickSendForm must not POST the concern before authentication", quickFetchCalls);

    const authenticatedStorage = quickSessionStorage();
    authenticatedStorage.setItem("letters.pendingConcern.ko", JSON.stringify({ body: "로그인 후 자동 전송할 고민은 충분한 길이입니다.", createdAt: Date.now() }));
    globalThis.window = { location: { href: "about:blank" }, sessionStorage: authenticatedStorage };
    quickRenderState = { values: ["", null], isPending: false };
    quickSessionState = { status: "authenticated", data: { user: { email: "quick-author@example.test" } } };
    quickSend.LetterQuickSendForm({ locale: "ko" });
    await Promise.all(quickTransitionPromises.splice(0));
    assert(quickFetchCalls.length === 1, "LetterQuickSendForm must POST the pending concern after Google sign-in", quickFetchCalls);
    const quickPayload = JSON.parse(quickFetchCalls[0][1]?.body ?? "{}");
    assert(quickPayload.body === "로그인 후 자동 전송할 고민은 충분한 길이입니다." && quickPayload.authorEmail === "quick-author@example.test" && quickPayload.category === "concern", "LetterQuickSendForm must submit the pending concern with the signed-in Google email", quickPayload);
    assert(authenticatedStorage.getItem("letters.pendingConcern.ko") === null, "LetterQuickSendForm must clear pending concern after accepted submit", authenticatedStorage._store);
    assert(globalThis.window.location.href === "/ko/letters/sent", "LetterQuickSendForm must navigate to the sent page after accepted submit", { href: globalThis.window.location.href });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }

  const routeCalls = [];
  const replyRoute = loadTsModule("app/[locale]/api/letters/reply/[token]/route.ts", {
    "next/server": {
      NextResponse: { json: (body, init) => Response.json(body, init) },
    },
    "@/lib/content": {
      resolveAppLocale: (locale) => (locale === "en" ? "en" : "ko"),
    },
    "@/lib/letters": {
      createLetterAnswer: async (input) => {
        routeCalls.push(input);
        return {
          ok: true,
          answer: {
            id: "answer-route-id",
            readTokenHash: "must-not-leak",
            readToken: "must-not-leak-either",
            body: "route body",
          },
          readToken: "route-read-token",
        };
      },
    },
  });
  const routeResponse = await replyRoute.POST(new Request("https://bible.ponslink.test/ko/api/letters/reply/route-reply-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body: "라우트 답장 본문은 충분한 길이를 갖습니다.", responderNickname: "요한", scriptureRef: "John 3:16" }),
  }), { params: Promise.resolve({ locale: "ko", token: "route-reply-token" }) });
  const routeJson = await routeResponse.json();
  assert(routeResponse.status === 200, "reply route should return 200 when createLetterAnswer succeeds", routeJson);
  assert(routeJson.ok === true && routeJson.answerId === "answer-route-id" && routeJson.readToken === "route-read-token", "reply route should return only answerId and readToken from a successful answer", routeJson);
  assert(!("answer" in routeJson) && !JSON.stringify(routeJson).includes("must-not-leak"), "reply route must not serialize raw answer internals", routeJson);
  assert(routeCalls[0]?.token === "route-reply-token" && routeCalls[0]?.locale === "ko", "reply route must pass locale and URL token into createLetterAnswer", routeCalls[0]);

  const ecosystemPath = requireFromRepo.resolve("../ecosystem.config.cjs");
  delete requireFromRepo.cache[ecosystemPath];
  const ecosystem = requireFromRepo("../ecosystem.config.cjs");
  const bibleApp = ecosystem.apps?.find((entry) => entry.name === "bible");
  const pm2EnvKeys = Object.keys(bibleApp?.env ?? {});
  for (const key of [
    "LETTERS_N8N_IMAGE_UPLOAD_URL",
    "LETTERS_N8N_IMAGE_UPLOAD_TOKEN",
    "LETTERS_GOOGLE_DRIVE_REFRESH_TOKEN",
    "LETTERS_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON",
    "LETTERS_GOOGLE_DRIVE_CLIENT_EMAIL",
    "LETTERS_GOOGLE_DRIVE_PRIVATE_KEY",
  ]) {
    process.env[key] = `qa-${key.toLowerCase()}`;
  }
  delete requireFromRepo.cache[ecosystemPath];
  const ecosystemWithImageEnv = requireFromRepo("../ecosystem.config.cjs");
  const bibleAppWithImageEnv = ecosystemWithImageEnv.apps?.find((entry) => entry.name === "bible");
  for (const key of [
    "LETTERS_N8N_IMAGE_UPLOAD_URL",
    "LETTERS_N8N_IMAGE_UPLOAD_TOKEN",
    "LETTERS_GOOGLE_DRIVE_REFRESH_TOKEN",
    "LETTERS_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON",
    "LETTERS_GOOGLE_DRIVE_CLIENT_EMAIL",
    "LETTERS_GOOGLE_DRIVE_PRIVATE_KEY",
  ]) {
    assert(bibleAppWithImageEnv?.env?.[key] === `qa-${key.toLowerCase()}`, `PM2 ecosystem env must pass through ${key} for production card image delivery`, { key, pm2EnvKeys });
  }

  console.log(JSON.stringify({
    status: "passed",
    contracts: [
      "public bundles omit user email fields, token hashes, and raw token fields",
      "createAnonymousLetter and createLetterAnswer return required results/emails without awaiting unresolved image generation promises",
      "createAnonymousLetter and createLetterAnswer select output locale from request country/browser language instead of trusting the route locale alone",
      "letter scripture references localize book titles for MIC 6:8 in Korean and English user-facing output",
      "letter and reply contact info is rejected before delivery/token consumption",
      "crisis safety blocks helper dispatch and public delivery metadata",
      "reply tokens are stored hashed, single-use, and required to resolve answer bundles",
      "answer read tokens are emailed as tokenized URLs but not persisted raw",
      "reply scripture references reject hidden contact info before token consumption",
      "participant OTP verifies an active opt-in participant without exposing raw email",
      "participant session tokens resolve server author identity without persisting raw tokens",
      "participant settings support opt-out, pause, locale preference, receiving caps, and resume through the session token",
      "participant history resolves authored and received letters without exposing raw email",
      "configured email encryption removes stored raw letter, participant, and delivery emails",
      "participant delivery emails include unsubscribe token links without persisting raw unsubscribe tokens",
      "active opted-in participants are selected before env fallback while excluding the author",
      "fixed master relay email is the primary fallback when no eligible relay participant exists",
      "blank nicknames receive cute random defaults for participants, authors, and responders",
      "relay availability reports no eligible human relay when only the author is registered",
      "public letter bundles strip scripture recommendation from author view",
      "relay accept sets canReceiveLetters through session token",
      "reply bundle and suggestion API include up to ten de-duplicated scripture recommendations for relay runner",
      "public letter and card bundles strip stored question/answer card generationMetadata and sensitive metadata values",
      "pre-reply letter emails keep designed HTML cards without image generation, while submitted answer emails use returned Drive image URLs as the hero before privacy-safe CTAs",
      "Codex Imagen disabled mode returns skipped provider metadata without remote execution",
      "Codex Imagen enabled mode uploads generated output to Drive, returns the Drive URL, and deletes local prompt/output artifacts",
      "letter POST API route returns 202 accepted:true without serializing bundle/cardId/letterId and schedules createAnonymousLetter after acknowledgement",
      "LetterWriteForm starts the concern POST, LetterReplyForm renders scripture slide controls, and LetterQuickSendForm preserves unauthenticated concerns for Google sign-in then auto-sends to the sent page",
      "PM2 ecosystem passes n8n and Google Drive image upload env through to production workers",
      "reply API route returns only answerId/readToken and does not serialize answer internals",
    ],
    artifacts: {
      tempDataFile: process.env.LETTERS_DATA_FILE,
      cardGenerationCalls: cardGenerationCalls.length,
      emailCalls: emailCalls.map((message) => ({ to: message.to, subject: message.subject })),
    },
  }, null, 2));
} finally {
  process.env = originalEnv;
  await rm(tempDir, { recursive: true, force: true });
}
