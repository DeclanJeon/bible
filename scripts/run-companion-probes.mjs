#!/usr/bin/env node
const { spawn } = await import("node:child_process");

const PORT = Number(process.env.COMPANION_PROBE_PORT || 3133);
const BASE_URL = process.env.COMPANION_PROBE_BASE_URL || `http://127.0.0.1:${PORT}`;
const SHOULD_START = !process.env.COMPANION_PROBE_BASE_URL;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function probeUrl(query) {
  return `${BASE_URL}/ko/companion?prompt=${encodeURIComponent(query)}`;
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

async function fetchHtml(query) {
  const route = probeUrl(query);
  const response = await fetch(route);
  assert(response.ok, `${route} returned HTTP ${response.status}`);
  return { route, html: await response.text() };
}

function includesAny(html, needles) {
  return needles.some((needle) => html.includes(needle));
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
    const { route, html } = await fetchHtml(probe.query);
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
    const noBodyNotice = html.includes("본문 저장 안 함") || html.includes("제목/링크/성구 연결만 보관") || html.includes("원문 전문은 GotQuestions.org");
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
