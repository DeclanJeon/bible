#!/usr/bin/env node
const { spawn } = await import("node:child_process");
const { readFile } = await import("node:fs/promises");

const PORT = Number(process.env.COMPANION_PROBE_PORT || 3133);
const BASE_URL = process.env.COMPANION_PROBE_BASE_URL || `http://127.0.0.1:${PORT}`;
const SHOULD_START = !process.env.COMPANION_PROBE_BASE_URL;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function probeUrl(query, locale = "ko") {
  return `${BASE_URL}/${locale}/companion?prompt=${encodeURIComponent(query)}`;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/ko/companion?prompt=${encodeURIComponent("사탄은 누구인가?")}`);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw lastError || new Error("companion probe server did not become ready");
}

async function fetchHtml(query, locale = "ko") {
  const route = probeUrl(query, locale);
  const response = await fetch(route);
  assert(response.ok, `${route} returned HTTP ${response.status}`);
  return { route, html: await response.text() };
}

function includesAny(html, needles) {
  return needles.some((needle) => html.includes(needle));
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[^;\s]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForRepeat(value) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assertNoImmediateDuplicatePhrase(text, phrase, probeId) {
  const normalizedText = normalizeForRepeat(text);
  const normalizedPhrase = normalizeForRepeat(phrase);
  if (!normalizedPhrase) return null;
  const doubled = `${normalizedPhrase} ${normalizedPhrase}`;
  const passed = !normalizedText.includes(doubled);
  assert(passed, `${probeId} repeats phrase back-to-back: ${phrase}`);
  return { type: "noImmediateDuplicatePhrase", phrase, passed };
}
function companionRelatedLabels(html) {
  return [...html.matchAll(/<h3 class="mt-3 text-lg font-bold tracking-tight text-\[var\(--ink\)\]">([^<]+)<\/h3>/g)].map((match) => match[1]);
}

function companionHelpTexts(html) {
  return [...html.matchAll(/(?:어떻게 도움이 되나|How it helps)<\/div><p class="mt-2 text-sm leading-7 text-\[var\(--muted\)\]">([^<]+)<\/p>/g)].map((match) => match[1]);
}

function assertCompanionCounselQuality(html, probeId) {
  const codeLabels = companionRelatedLabels(html).filter((label) => /^[1-3]?[A-Z]{2,3} \d+:\d+/.test(label.trim()));
  assert(codeLabels.length === 0, `${probeId} exposes untranslated Bible code labels: ${codeLabels.join(", ")}`);

  const verseOnlyHelps = companionHelpTexts(html).filter((value) => /^\d+\.?$/.test(value.trim()));
  assert(verseOnlyHelps.length === 0, `${probeId} renders verse-number-only help text`);

  return [
    { type: "noCodeReferenceLabels", passed: true },
    { type: "noVerseOnlyHelpText", passed: true },
  ];
}
function assertNoVisibleRawReferenceCodes(html, probeId) {
  const visible = visibleText(html);
  const rawReferences = visible.match(/\b(?:[1-3]?[A-Z]{2,3}) \d+:\d+(?:-\d+)?\b/g) ?? [];
  const allowed = new Set(["I AM"]);
  const unexpected = rawReferences.filter((value) => !allowed.has(value));
  assert(unexpected.length === 0, `${probeId} exposes raw Bible reference codes in visible text: ${unexpected.join(", ")}`);
  return { type: "noVisibleRawReferenceCodes", passed: true };
}



const probes = [
  {
    id: "heaven-after-death",
    query: "천국은 어떤 곳인가? 죽어서 가는 곳인가?",
    requiredAny: ["요한계시록 21:1-5", "새 하늘", "새 하늘과 새 땅"],
    requiredAll: ["GotQuestions 관련 문답"],
    requiredAnyLinks: ["Korean-heaven-like", "Korean-Heaven-perfect", "Korean-afterlife", "Korean-life-after-death"],
    forbidden: ["마태복음 16:16-20"],
  },
  {
    id: "satan",
    query: "사탄은 누구인가?",
    requiredAll: ["GotQuestions 관련 문답", "Korean-Satan.html"],
    requiredAny: ["요한계시록", "베드로전서", "이사야", "누가복음"],
    forbidden: [],
  },
  {
    id: "salvation-plan",
    query: "구원받으려면 무엇을 믿어야 하나요?",
    requiredAll: ["GotQuestions 관련 문답"],
    requiredAnyLinks: ["Korean-Plan-Salvation", "Korean-saved", "Korean-salvation"],
    requiredAny: ["요한복음 3:16", "로마서", "구원"],
    forbidden: [],
  },
  {
    id: "genesis-book-title",
    query: "창세기 성경적으로 설명해줘",
    requiredAll: ["GotQuestions 관련 문답", "Korean-book-Genesis.html"],
    forbidden: [],
  },
  {
    id: "romans-adversarial-wrapper",
    query: "회의적인 사람이 '로마서'라고 물으면 어떻게 답하나요?",
    requiredAll: ["GotQuestions 관련 문답", "Korean-book-Romans.html"],
    forbidden: [],
  },
];
probes.push(
  {
    id: "human-how-to-live",
    query: "사람은 어떻게 살아야 하는 것일까?",
    requiredAll: ["미가 6:8", "관련 성구 상담 노트"],
    requiredAny: ["마태복음 22:37-40", "전도서 12:13-14"],
    forbidden: ["히브리서 13:21-25"],
  },
  {
    id: "human-purpose-why-live",
    query: "사람은 왜 사는가?",
    requiredAll: ["에베소서 2:10", "관련 성구 상담 노트"],
    requiredAny: ["시편 139:13-16", "창세기 1:26-28", "전도서 12:13-14"],
    forbidden: ["히브리서 13:21-25"],
  },
  {
    id: "death-afterlife",
    query: "죽음 이후에는 어떻게 되나요?",
    requiredAll: ["로마서 6:22-23", "관련 성구 상담 노트"],
    requiredAny: ["고린도전서 15:54-58", "요한복음 11:25-26", "요한계시록 21:3-4"],
    forbidden: ["요한계시록 17:5-8"],
  },
);
probes.push(
  {
    id: "anxiety-care",
    query: "불안하고 두려울 때 어떤 말씀을 읽어야 하나요?",
    requiredAll: ["관련 성구 상담 노트"],
    requiredAny: ["마태복음 11:28-30", "빌립보서 4:6-7", "시편", "이사야"],
    forbidden: [],
  },
  {
    id: "forgiveness-practice",
    query: "나를 상처 준 사람을 용서해야 하나요?",
    requiredAll: ["관련 성구 상담 노트"],
    requiredAny: ["마태복음 6:14-15", "에베소서 4:32", "골로새서 3:13"],
    forbidden: [],
  },
  {
    id: "identity-worth",
    query: "나는 하나님 앞에서 어떤 가치가 있나요?",
    requiredAll: ["관련 성구 상담 노트"],
    requiredAny: ["창세기 1:26-28", "시편 139:13-16", "에베소서 2:10"],
    forbidden: [],
  },
  {
    id: "scripture-definition",
    query: "성경은 무엇인가요?",
    requiredAll: ["관련 성구 상담 노트"],
    requiredAny: ["디모데후서 3:16-17", "히브리서 4:12", "시편 119"],
    forbidden: [],
  },
  {
    id: "jesus-cross",
    query: "예수님은 왜 십자가에서 죽으셨나요?",
    requiredAll: ["관련 성구 상담 노트"],
    requiredAny: ["마가복음 10:45", "로마서", "베드로전서", "이사야"],
    forbidden: [],
  },
);
probes.push(
  {
    id: "en-human-how-to-live",
    locale: "en",
    query: "How should a person live?",
    requiredAll: ["Micah 6:8", "Related passage counsel"],
    requiredAny: ["Matthew 22:37-40", "Ecclesiastes 12:13-14", "Ephesians 2:10"],
    forbidden: ["HEB 13:21-25", "LUK "],
  },
  {
    id: "en-death-afterlife",
    locale: "en",
    query: "What happens after death?",
    requiredAll: ["Romans 6:22-23", "Related passage counsel"],
    requiredAny: ["1 Corinthians 15:54-58", "John 11:25-26", "Revelation 21:3-4"],
    forbidden: ["REV 17:5-8"],
  },
  {
    id: "offtopic-everyday-choice",
    query: "오늘 점심 뭐 먹지?",
    requiredAll: ["본문 추천 보류"],
    requiredAny: ["성경 본문 추천을 보류", "범위를 벗어나"],
    forbidden: [],
  },
);

try {
  const okfCases = JSON.parse(await readFile("qa/gotquestions-okf-cases.generated.json", "utf8"))
    .filter((row) => row.surface === "companion")
    .map((row) => ({
      id: row.id,
      query: row.query,
      requiredAll: row.requiredAll,
      requiredAny: row.requiredAny,
      requiredAnyLinks: row.requiredAnyLinks,
      forbidden: row.forbidden ?? [],
    }));
  probes.push(...okfCases.filter((row) => !probes.some((probe) => probe.id === row.id)));
} catch {
  // OKF companion probes are generated by `npm run okf:gotquestions:qa-cases`.
}

let server = null;
try {
  if (SHOULD_START) {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", () => {});
    server.stderr.on("data", () => {});
  }

  await waitForServer();
  const results = [];
  for (const probe of probes) {
    const { route, html } = await fetchHtml(probe.query, probe.locale);
    const assertions = [];
    if (probe.requiredAll?.length) {
      for (const needle of probe.requiredAll) {
        const passed = html.includes(needle);
        assertions.push({ type: "requiredAll", needle, passed });
        assert(passed, `${probe.id} missing required text ${needle}`);
      }
    }
    if (probe.requiredAny?.length) {
      const passed = includesAny(html, probe.requiredAny);
      assertions.push({ type: "requiredAny", needles: probe.requiredAny, passed });
      assert(passed, `${probe.id} missing any of ${probe.requiredAny.join(", ")}`);
    }
    if (probe.requiredAnyLinks?.length) {
      const passed = includesAny(html, probe.requiredAnyLinks);
      assertions.push({ type: "requiredAnyLinks", needles: probe.requiredAnyLinks, passed });
      assert(passed, `${probe.id} missing any link marker ${probe.requiredAnyLinks.join(", ")}`);
    }
    for (const needle of probe.forbidden ?? []) {
      const passed = !html.includes(needle);
      assertions.push({ type: "forbidden", needle, passed });
      assert(passed, `${probe.id} contains forbidden text ${needle}`);
    }
    const noBodyNotice = html.includes("본문 저장 안 함") || html.includes("제목/링크/성구 연결만 보관") || html.includes("원문 전문은 GotQuestions.org") || html.includes("This app stores only title, link, category, and Scripture-link metadata.");
    const duplicateAssertion = assertNoImmediateDuplicatePhrase(visibleText(html), probe.query, probe.id);
    if (duplicateAssertion) assertions.push(duplicateAssertion);
    assertions.push(...assertCompanionCounselQuality(html, probe.id));
    assertions.push(assertNoVisibleRawReferenceCodes(html, probe.id));
    assertions.push({ type: "noBodyStorageNotice", passed: noBodyNotice });
    assert(noBodyNotice, `${probe.id} missing no-body-storage notice`);
    results.push({ id: probe.id, route, query: probe.query, status: "passed", assertions, matchedText: probe.requiredAll ?? [], forbiddenTextAbsent: probe.forbidden ?? [] });
  }
  console.log(JSON.stringify({ status: "passed", baseUrl: BASE_URL, probes: results }, null, 2));
} finally {
  if (server) {
    server.kill("SIGTERM");
    await sleep(500);
    if (!server.killed) server.kill("SIGKILL");
  }
}
