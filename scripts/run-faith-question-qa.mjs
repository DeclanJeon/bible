process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "faith-question-qa-key";
process.env.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://faith-question-qa.invalid";
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || "faith-question-qa-model";
process.env.HERMES_CHAT_COMPLETIONS_FIRST = "1";

const originalFetch = globalThis.fetch;
let hermesCallCount = 0;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith("https://faith-question-qa.invalid")) {
    hermesCallCount += 1;
    const generated = [
      {
        summary: "Unsupported MAT 7:21, ROM 8:28, PHP 4:13, MRK 1:1, JAS 1:5, EZK 36:26, COL 3:23-25, and 마태복음 7:21 should be rejected.",
        biblicalDirection: "This response has only unsupported Bible references and no unsupported URL.",
        caveat: "AI guide only.",
        passageReasons: [{ passageKey: "COL-3-23-24", reason: "Unsupported ROM 8:28 must not pass." }],
        resourceReasons: [{ resourceId: "gq-bible-work", reason: "Unsupported alias PHP 4:13 must not pass." }],
        nextQuestions: ["Unsupported 마태복음 7:21 should not pass."],
      },
      {
        summary: "Unsupported external URL should be rejected.",
        biblicalDirection: "This cites supplied 골로새서 3:23 but includes https://example.invalid/body.",
        caveat: "AI guide only.",
        passageReasons: [{ passageKey: "COL-3-23-24", reason: "Supplied passage key is valid." }],
        resourceReasons: [{ resourceId: "gq-bible-work", reason: "Unsupported external URL https://example.invalid/body must not pass." }],
        nextQuestions: ["How should I continue?"],
      },
      {
        summary: "Unsupported 마태복음 7:21 should be rejected.",
        biblicalDirection: "This response has only a Korean unsupported Bible reference.",
        caveat: "AI guide only.",
        passageReasons: [{ passageKey: "COL-3-23-24", reason: "Supplied passage key is valid but 마태복음 7:21 is not." }],
        resourceReasons: [{ resourceId: "gq-bible-work", reason: "Supplied resource id is valid." }],
        nextQuestions: ["Unsupported Korean reference only."],
      },
    ][Math.min(hermesCallCount - 1, 2)];
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(generated) } }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return originalFetch(input, init);
};

const routeModule = await import("../.next/server/app/api/faith-questions/route.js");
const post = routeModule.default?.routeModule?.userland?.POST ?? routeModule.routeModule?.userland?.POST;
if (typeof post !== "function") {
  throw new Error("Built faith-questions route POST handler not found. Run `npm run build` before this QA script.");
}

async function callFaithQuestion(body) {
  const request = new Request("http://localhost/api/faith-questions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await post(request);
  return { status: response.status, data: await response.json() };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const business = await callFaithQuestion({ query: "사업은 어떻게 하면 될까요?", locale: "ko" });
assert(business.status === 200, "business question should return 200");
assert(business.data.meta?.bibleRagUsed === true, "business question should use Bible RAG");
assert(business.data.meta?.externalBodyFetched === false, "business question must not fetch external bodies");
assert(business.data.meta?.externalBodyStored === false, "business question must not store external bodies");
assert(business.data.meta?.aiUsed === false, "unsupported Hermes prose should fall back without aiUsed");
assert(business.data.meta?.generationProvider === "hermes-fallback", "unsupported Hermes prose should be reported as fallback");
assert(business.data.resources?.some((resource) => resource.id === "gq-bible-work"), "business question should include work resource metadata");
assert(business.data.passages?.some((passage) => passage.reference?.code === "COL"), "business question should include Colossians work passage");
assert(!business.data.summary.includes("ROM 8:28"), "unsupported generated reference must not appear in accepted summary");
assert(!business.data.summary.includes("MAT 7:21"), "unsupported generated code reference must not appear in accepted summary");
assert(!business.data.summary.includes("PHP 4:13"), "unsupported generated alias reference must not appear in accepted summary");
assert(!business.data.summary.includes("COL 3:23-25"), "unsupported generated expanded range must not appear in accepted summary");

const urlFallback = await callFaithQuestion({ query: "사업은 어떻게 하면 될까요?", locale: "ko" });
assert(urlFallback.status === 200, "unsupported URL case should return 200 with fallback");
assert(urlFallback.data.meta?.generationProvider === "hermes-fallback", "unsupported URL should force Hermes fallback");
assert(!urlFallback.data.biblicalDirection?.includes("example.invalid"), "unsupported generated URL must not appear in accepted direction");
const koreanFallback = await callFaithQuestion({ query: "사업은 어떻게 하면 될까요?", locale: "ko" });
assert(koreanFallback.status === 200, "unsupported Korean reference case should return 200 with fallback");
assert(koreanFallback.data.meta?.generationProvider === "hermes-fallback", "unsupported Korean reference should force Hermes fallback");
assert(!koreanFallback.data.summary.includes("마태복음 7:21"), "unsupported generated Korean reference must not appear in accepted summary");


const heaven = await callFaithQuestion({ query: "천국은 죽어서 가는 곳인가요?", locale: "ko" });
assert(heaven.status === 200, "heaven question should return 200");
assert(heaven.data.passages?.some((passage) => passage.reference?.code === "MAT" && passage.reference?.chapter === 6), "heaven question should keep curated Matthew 6 anchor");
assert(heaven.data.meta?.evidenceLocked === true, "heaven question should report evidence lock");

const invalid = await callFaithQuestion({ query: "", locale: "ko" });
assert(invalid.status === 400, "empty question should return 400");
assert(invalid.data.error === "query is required", "empty question error should be stable");

globalThis.fetch = originalFetch;

console.log(JSON.stringify({
  status: "passed",
  cases: [
    { id: "business", mode: business.data.meta.mode, generationProvider: business.data.meta.generationProvider, resources: business.data.resources.map((resource) => resource.id).slice(0, 3), passages: business.data.passages.map((passage) => passage.label).slice(0, 4) },
    { id: "url-fallback", mode: urlFallback.data.meta.mode, generationProvider: urlFallback.data.meta.generationProvider },
    { id: "korean-reference-fallback", mode: koreanFallback.data.meta.mode, generationProvider: koreanFallback.data.meta.generationProvider },
    { id: "heaven", mode: heaven.data.meta.mode, passages: heaven.data.passages.map((passage) => passage.label).slice(0, 4) },
    { id: "invalid", status: invalid.status, error: invalid.data.error },
  ],
}, null, 2));
