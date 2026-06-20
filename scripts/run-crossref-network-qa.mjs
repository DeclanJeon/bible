import { readFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};

const baseUrl = option('--base-url', process.env.BENCHMARK_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const referenceSlug = option('--reference', 'MAT-11-28-30');
const secondaryReferenceSlug = option('--secondary-reference', 'GEN-1-1');
const locales = option('--locales', 'en,ko').split(',').map((locale) => locale.trim()).filter(Boolean);
const highlightLimit = Number(option('--highlight-limit', '4'));
const reflectPrompt = option('--reflect-prompt', 'I am weary and need rest in Christ.');
const lowConfidencePrompt = option('--low-confidence-prompt', 'Should I buy coffee or tea this afternoon?');

const SOURCE_FILES = [
  { source: 'openbible', file: 'data/knowledge/openbible-crossrefs.json' },
  { source: 'crossreferences-kjv', file: 'data/knowledge/crossreferences-kjv.json' },
];

const failures = [];
const rows = [];

function fail(assertion, detail) {
  failures.push({ assertion, detail });
}

function record(name, ok, detail = undefined) {
  rows.push({ name, ok, detail });
  if (!ok) fail(name, detail);
}

function parseSlug(slug) {
  const parts = slug.split('-');
  if (parts.length < 3) throw new Error(`Invalid reference slug: ${slug}`);
  const code = parts[0].toUpperCase();
  const chapter = Number(parts[1]);
  const startVerse = Number(parts[2]);
  const endVerse = parts[3] ? Number(parts[3]) : startVerse;
  if (!code || !Number.isInteger(chapter) || !Number.isInteger(startVerse) || !Number.isInteger(endVerse)) {
    throw new Error(`Invalid reference slug: ${slug}`);
  }
  return { code, chapter, startVerse, endVerse };
}

function parseLabel(label) {
  const match = /^(\d?[A-Z]{2,3}) (\d+):(\d+)(?:-(\d+))?$/.exec(label);
  if (!match) throw new Error(`Invalid verse label: ${label}`);
  const [, code, chapterRaw, startRaw, endRaw] = match;
  const startVerse = Number(startRaw);
  return { code, chapter: Number(chapterRaw), startVerse, endVerse: endRaw ? Number(endRaw) : startVerse };
}

function spanKey(span) {
  return `${span.code} ${span.chapter}:${span.startVerse}${span.endVerse === span.startVerse ? '' : `-${span.endVerse}`}`;
}

function directedKey(from, to) {
  return `${spanKey(from)} -> ${spanKey(to)}`;
}

function edgePairKey(edge) {
  const from = spanKey(edge.from);
  const to = spanKey(edge.to);
  return from < to ? `${from} <> ${to}` : `${to} <> ${from}`;
}

function overlaps(a, b) {
  return a.code === b.code && a.chapter === b.chapter && a.startVerse <= b.endVerse && b.startVerse <= a.endVerse;
}

function selectedVerseLabels(reference) {
  const labels = [];
  for (let verse = reference.startVerse; verse <= reference.endVerse; verse += 1) {
    labels.push(`${reference.code} ${reference.chapter}:${verse}`);
  }
  return labels;
}

async function readJson(relPath) {
  const raw = await readFile(path.join(process.cwd(), relPath), 'utf8');
  return JSON.parse(raw);
}

async function buildExpected(reference) {
  const selectedLabels = selectedVerseLabels(reference);
  const selectedLabelSet = new Set(selectedLabels);
  const outgoing = new Map();
  const incoming = new Map();
  const sources = [];

  for (const sourceConfig of SOURCE_FILES) {
    const store = await readJson(sourceConfig.file);
    sources.push({ source: sourceConfig.source, metadata: store.source });

    for (const selectedLabel of selectedLabels) {
      const from = parseLabel(selectedLabel);
      for (const link of store.byVerse?.[selectedLabel] || []) {
        if (overlaps(link.to, reference)) continue;
        const key = directedKey(from, link.to);
        outgoing.set(key, { from, to: link.to });
      }
    }

    for (const [fromLabel, links] of Object.entries(store.byVerse || {})) {
      const from = parseLabel(fromLabel);
      for (const link of links) {
        if (!overlaps(link.to, reference)) continue;
        if (selectedLabelSet.has(fromLabel) || overlaps(from, reference)) continue;
        const key = directedKey(from, link.to);
        incoming.set(key, { from, to: link.to });
      }
    }
  }

  const directed = new Map([...outgoing, ...incoming]);
  const mutualPairs = new Set();
  for (const edge of directed.values()) {
    if (directed.has(directedKey(edge.to, edge.from))) mutualPairs.add(edgePairKey(edge));
  }

  return {
    outgoingCount: outgoing.size,
    incomingCount: incoming.size,
    totalEdges: outgoing.size + incoming.size,
    mutualCount: mutualPairs.size,
    sources,
  };
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  let json = null;
  try {
    json = await response.json();
  } catch {
    // Keep the HTTP status failure below evidence-locked without inventing a payload shape.
  }
  return { response, json };
}

function assertNumber(value) {
  return Number.isInteger(value) && value >= 0;
}

function allEdges(network) {
  return [
    ...(network.all?.outgoing || []),
    ...(network.all?.incoming || []),
  ];
}

function validateSummaryShape(summary, reference) {
  return Boolean(summary)
    && summary.reference?.code === reference.code
    && summary.reference?.chapter === reference.chapter
    && summary.reference?.startVerse === reference.startVerse
    && summary.reference?.endVerse === reference.endVerse
    && assertNumber(summary.totalEdges)
    && assertNumber(summary.outgoingCount)
    && assertNumber(summary.incomingCount)
    && assertNumber(summary.mutualCount)
    && assertNumber(summary.consensusCount)
    && assertNumber(summary.voteSupportedCount)
    && assertNumber(summary.phraseAnchorCount)
    && Array.isArray(summary.booksTouched)
    && Array.isArray(summary.canonSectionsTouched)
    && Array.isArray(summary.strongestSources)
    && Array.isArray(summary.strongestBooks)
    && typeof summary.scopeLabel === 'string'
    && typeof summary.coverageNote === 'string';
}

function validatePassagePayload(primary) {
  return Boolean(primary)
    && typeof primary.reference === 'string'
    && primary.referenceSpan
    && (primary.book === null || (typeof primary.book?.code === 'string' && typeof primary.book?.name === 'string'))
    && Array.isArray(primary.verses)
    && primary.verses.every((verse) => typeof verse.code === 'string' && assertNumber(verse.chapter) && assertNumber(verse.verse) && typeof verse.text === 'string')
    && typeof primary.href === 'string';
}

function validateEdge(edge) {
  return Boolean(edge)
    && typeof edge.id === 'string'
    && edge.from && edge.to
    && ['outgoing', 'incoming', 'mutual'].includes(edge.direction)
    && Array.isArray(edge.relationTypes)
    && Array.isArray(edge.evidence)
    && typeof edge.score === 'number'
    && assertNumber(edge.sourceCount)
    && assertNumber(edge.totalVotes)
    && Array.isArray(edge.anchorPhrases)
    && typeof edge.displayReference === 'string'
    && typeof edge.href === 'string'
    && edge.evidence.length > 0
    && edge.evidence.every((item) => typeof item.source === 'string'
      && typeof item.sourceName === 'string'
      && (item.sourceUrl === undefined || typeof item.sourceUrl === 'string')
      && (item.license === undefined || typeof item.license === 'string')
      && Array.isArray(item.anchorPhrases)
      && Array.isArray(item.anchorVerses));
}

function validateNetworkShape(network, reference) {
  return validatePassagePayload(network.primary)
    && validateSummaryShape(network.summary, reference)
    && Array.isArray(network.highlights)
    && network.highlights.every(validateEdge)
    && Array.isArray(network.all?.outgoing)
    && Array.isArray(network.all?.incoming)
    && Array.isArray(network.all?.mutual)
    && allEdges(network).every(validateEdge)
    && typeof network.grouped === 'object'
    && typeof network.background === 'object'
    && typeof network.dataQuality === 'object'
    && assertNumber(network.dataQuality.skippedSourceRows)
    && assertNumber(network.dataQuality.unsupportedRanges)
    && assertNumber(network.dataQuality.collapsedRanges)
    && assertNumber(network.dataQuality.missingCanonVerses)
    && Array.isArray(network.dataQuality.notes)
    && Array.isArray(network.sources)
    && network.sources.length >= 2
    && network.sources.every((source) => typeof source.label === 'string' && typeof source.url === 'string')
    && typeof network.version?.generatedAt === 'string'
    && Array.isArray(network.version?.sourceVersions)
    && network.version.sourceVersions.every((source) => typeof source.source === 'string' && (source.retrievedAt === undefined || typeof source.retrievedAt === 'string') && (source.license === undefined || typeof source.license === 'string'));
}

function validateGroupedCounts(network) {
  const edges = allEdges(network);
  const grouped = network.grouped || {};
  const groups = [grouped.byBook, grouped.byCanonSection, grouped.byRelation, grouped.bySource].filter(Array.isArray);
  return groups.every((items) => items.every((group) => assertNumber(group.count) && (!group.edges || group.edges.length === group.count || group.edges.length <= edges.length)));
}

function containsFullGraphPayload(value) {
  return Boolean(value?.all?.outgoing || value?.all?.incoming || value?.grouped?.byBook);
}

function validateReflectPayload(payload) {
  return Boolean(payload)
    && typeof payload.state === 'string'
    && typeof payload.prompt === 'string'
    && typeof payload.normalizedQuestion === 'string'
    && typeof payload.confidence === 'string'
    && typeof payload.meta?.answerMode === 'string'
    && (payload.primary === null || (
      payload.primary.reference
      && typeof payload.primary.text === 'string'
      && typeof payload.primary.reason === 'string'
      && typeof payload.primary.score === 'number'
    ))
    && (payload.explanation === null || (
      typeof payload.explanation.userConcernSummary === 'string'
      && typeof payload.explanation.connectionToUser === 'string'
      && typeof payload.explanation.whyThisPassage === 'string'
      && (payload.explanation.limits === undefined || typeof payload.explanation.limits === 'string')
    ))
    && Array.isArray(payload.relatedPassages)
    && typeof payload.questionUnderstanding?.answerMode === 'string';
}

function omitsLegacyReflectGraphFields(payload) {
  return !Object.hasOwn(payload, 'crossReferenceSummary')
    && !Object.hasOwn(payload, 'crossReferenceHighlights')
    && !Object.hasOwn(payload, 'crossReferenceNetworkUrl')
    && !containsFullGraphPayload(payload);
}
const reference = parseSlug(referenceSlug);
const expected = await buildExpected(reference);

for (const locale of locales) {
  const fullUrl = `${baseUrl}/${locale}/api/crossrefs/${referenceSlug}?includeExcerpts=preview&highlightLimit=${highlightLimit}`;
  const { response, json: network } = await fetchJson(fullUrl);
  record(`${locale}: full endpoint responds 2xx`, response.ok, { status: response.status, url: fullUrl });
  if (!response.ok || !network) continue;

  record(`${locale}: public DTO shape matches DESIGN.md`, validateNetworkShape(network, reference));
  record(`${locale}: summary count convention is directed outgoing+incoming`, network.summary.totalEdges === network.summary.outgoingCount + network.summary.incomingCount, network.summary);
  record(`${locale}: outgoing exact count matches source stores`, network.summary.outgoingCount === expected.outgoingCount && network.all.outgoing.length === expected.outgoingCount, { expected: expected.outgoingCount, summary: network.summary.outgoingCount, actual: network.all.outgoing.length });
  record(`${locale}: incoming exact count matches reverse source index`, network.summary.incomingCount === expected.incomingCount && network.all.incoming.length === expected.incomingCount, { expected: expected.incomingCount, summary: network.summary.incomingCount, actual: network.all.incoming.length });
  record(`${locale}: total edge count is not truncated`, allEdges(network).length === expected.totalEdges && network.summary.totalEdges === expected.totalEdges, { expected: expected.totalEdges, summary: network.summary.totalEdges, actual: allEdges(network).length });
  record(`${locale}: mutual count uses unordered pair convention`, network.summary.mutualCount === expected.mutualCount, { expected: expected.mutualCount, actual: network.summary.mutualCount });
  record(`${locale}: highlights are separate subset only`, network.highlights.length <= highlightLimit && network.highlights.length < network.summary.totalEdges && allEdges(network).length === network.summary.totalEdges, { highlightLimit, highlights: network.highlights.length, totalEdges: network.summary.totalEdges });
  record(`${locale}: preview excerpts are present for every full edge`, allEdges(network).every((edge) => typeof edge.excerpt === 'string' && edge.excerpt.length > 0));
  record(`${locale}: grouped counts are derived from full graph`, validateGroupedCounts(network));
  record(`${locale}: provenance keeps source URLs licenses and timestamps`, network.version.sourceVersions.some((source) => source.source === 'openbible' && source.license && source.retrievedAt) && network.version.sourceVersions.some((source) => source.source === 'crossreferences-kjv' && source.license && source.retrievedAt));
  record(`${locale}: evidence preserves source names and raw evidence kind`, allEdges(network).some((edge) => edge.evidence.some((item) => item.source === 'openbible' && item.sourceName && item.sourceUrl && item.license && typeof item.votes === 'number')) && allEdges(network).some((edge) => edge.evidence.some((item) => item.source === 'crossreferences-kjv' && item.sourceName && item.sourceUrl && item.license && item.anchorPhrases.length > 0)));
  record(`${locale}: coverage copy is dataset-scoped not theologically exhaustive`, /dataset|데이터셋|수집된/i.test(`${network.summary.scopeLabel} ${network.summary.coverageNote}`) && !/all possible|모든 가능한/i.test(`${network.summary.scopeLabel} ${network.summary.coverageNote}`));

  const noneUrl = `${baseUrl}/${locale}/api/crossrefs/${referenceSlug}?includeExcerpts=none&highlightLimit=${highlightLimit}`;
  const { response: noneResponse, json: noneNetwork } = await fetchJson(noneUrl);
  record(`${locale}: includeExcerpts=none responds 2xx`, noneResponse.ok, { status: noneResponse.status, url: noneUrl });
  if (noneResponse.ok && noneNetwork) {
    record(`${locale}: includeExcerpts=none preserves exact counts`, noneNetwork.summary.totalEdges === network.summary.totalEdges && allEdges(noneNetwork).length === allEdges(network).length);
    record(`${locale}: includeExcerpts=none suppresses edge excerpts`, allEdges(noneNetwork).every((edge) => !edge.excerpt));
  }

  const fullExcerptUrl = `${baseUrl}/${locale}/api/crossrefs/${referenceSlug}?includeExcerpts=full&highlightLimit=${highlightLimit}`;
  const { response: fullExcerptResponse, json: fullExcerptNetwork } = await fetchJson(fullExcerptUrl);
  record(`${locale}: includeExcerpts=full responds 2xx`, fullExcerptResponse.ok, { status: fullExcerptResponse.status, url: fullExcerptUrl });
  if (fullExcerptResponse.ok && fullExcerptNetwork) {
    record(`${locale}: includeExcerpts=full preserves exact counts`, fullExcerptNetwork.summary.totalEdges === network.summary.totalEdges && allEdges(fullExcerptNetwork).length === allEdges(network).length);
  }

  const highHighlightLimit = 12;
  const highHighlightUrl = `${baseUrl}/${locale}/api/crossrefs/${referenceSlug}?includeExcerpts=preview&highlightLimit=${highHighlightLimit}`;
  const { response: highHighlightResponse, json: highHighlightNetwork } = await fetchJson(highHighlightUrl);
  record(`${locale}: larger highlightLimit responds 2xx`, highHighlightResponse.ok, { status: highHighlightResponse.status, url: highHighlightUrl });
  if (highHighlightResponse.ok && highHighlightNetwork) {
    record(`${locale}: highlightLimit changes highlights only`, highHighlightNetwork.summary.totalEdges === network.summary.totalEdges && allEdges(highHighlightNetwork).length === allEdges(network).length && highHighlightNetwork.highlights.length <= highHighlightLimit);
  }

  const outgoingUrl = `${baseUrl}/${locale}/api/crossrefs/${referenceSlug}?direction=outgoing&highlightLimit=${highlightLimit}`;
  const { response: outgoingResponse, json: outgoingNetwork } = await fetchJson(outgoingUrl);
  record(`${locale}: direction=outgoing responds 2xx`, outgoingResponse.ok, { status: outgoingResponse.status, url: outgoingUrl });
  if (outgoingResponse.ok && outgoingNetwork) {
    record(`${locale}: direction=outgoing keeps global counts and exposes only outgoing edges`, outgoingNetwork.summary.totalEdges === network.summary.totalEdges && outgoingNetwork.summary.outgoingCount === network.summary.outgoingCount && outgoingNetwork.summary.incomingCount === network.summary.incomingCount && outgoingNetwork.all.outgoing.length === network.all.outgoing.length && outgoingNetwork.all.incoming.length === 0);
  }

  const incomingUrl = `${baseUrl}/${locale}/api/crossrefs/${referenceSlug}?direction=incoming&highlightLimit=${highlightLimit}`;
  const { response: incomingResponse, json: incomingNetwork } = await fetchJson(incomingUrl);
  record(`${locale}: direction=incoming responds 2xx`, incomingResponse.ok, { status: incomingResponse.status, url: incomingUrl });
  if (incomingResponse.ok && incomingNetwork) {
    record(`${locale}: direction=incoming keeps global counts and exposes only incoming edges`, incomingNetwork.summary.totalEdges === network.summary.totalEdges && incomingNetwork.summary.outgoingCount === network.summary.outgoingCount && incomingNetwork.summary.incomingCount === network.summary.incomingCount && incomingNetwork.all.incoming.length === network.all.incoming.length && incomingNetwork.all.outgoing.length === 0);
  }

  const summaryOnlyUrl = `${baseUrl}/${locale}/api/crossrefs/${referenceSlug}?summaryOnly=1&highlightLimit=${highlightLimit}`;
  const { response: summaryOnlyResponse, json: summaryOnlyNetwork } = await fetchJson(summaryOnlyUrl);
  record(`${locale}: summaryOnly responds 2xx`, summaryOnlyResponse.ok, { status: summaryOnlyResponse.status, url: summaryOnlyUrl });
  if (summaryOnlyResponse.ok && summaryOnlyNetwork) {
    record(`${locale}: summaryOnly keeps exact counts and omits excerpts`, validateSummaryShape(summaryOnlyNetwork.summary, reference) && summaryOnlyNetwork.summary.totalEdges === network.summary.totalEdges && (!containsFullGraphPayload(summaryOnlyNetwork) || (allEdges(summaryOnlyNetwork).length === allEdges(network).length && allEdges(summaryOnlyNetwork).every((edge) => !edge.excerpt))));
  }
}

if (locales.length >= 2) {
  const localeSummaries = [];
  for (const locale of locales) {
    const { response, json } = await fetchJson(`${baseUrl}/${locale}/api/crossrefs/${referenceSlug}?summaryOnly=1`);
    if (response.ok && json?.summary) localeSummaries.push({ locale, summary: json.summary });
  }
  if (localeSummaries.length >= 2) {
    const first = localeSummaries[0].summary;
    record('locale summaries preserve graph counts', localeSummaries.every(({ summary }) => summary.totalEdges === first.totalEdges && summary.outgoingCount === first.outgoingCount && summary.incomingCount === first.incomingCount && summary.mutualCount === first.mutualCount), localeSummaries.map(({ locale, summary }) => ({ locale, totalEdges: summary.totalEdges, outgoingCount: summary.outgoingCount, incomingCount: summary.incomingCount, mutualCount: summary.mutualCount })));
    const labels = new Set(localeSummaries.map(({ summary }) => summary.scopeLabel));
    record('locale summaries localize scope labels without changing counts', labels.size > 1, localeSummaries.map(({ locale, summary }) => ({ locale, scopeLabel: summary.scopeLabel })));
  }
}

if (secondaryReferenceSlug && secondaryReferenceSlug !== referenceSlug) {
  const secondaryReference = parseSlug(secondaryReferenceSlug);
  const secondaryExpected = await buildExpected(secondaryReference);
  for (const locale of locales) {
    const secondaryUrl = `${baseUrl}/${locale}/api/crossrefs/${secondaryReferenceSlug}?includeExcerpts=preview&highlightLimit=${highlightLimit}`;
    const { response, json: secondaryNetwork } = await fetchJson(secondaryUrl);
    record(`${locale}: secondary known anchor responds 2xx`, response.ok, { status: response.status, url: secondaryUrl });
    if (response.ok && secondaryNetwork) {
      record(`${locale}: secondary known anchor exact outgoing/incoming counts`, secondaryNetwork.summary.outgoingCount === secondaryExpected.outgoingCount && secondaryNetwork.summary.incomingCount === secondaryExpected.incomingCount, { reference: secondaryReferenceSlug, expectedOutgoing: secondaryExpected.outgoingCount, actualOutgoing: secondaryNetwork.summary.outgoingCount, expectedIncoming: secondaryExpected.incomingCount, actualIncoming: secondaryNetwork.summary.incomingCount });
      record(`${locale}: secondary known anchor is not truncated`, allEdges(secondaryNetwork).length === secondaryExpected.totalEdges && secondaryNetwork.summary.totalEdges === secondaryExpected.totalEdges, { reference: secondaryReferenceSlug, expectedTotal: secondaryExpected.totalEdges, actualTotal: secondaryNetwork.summary.totalEdges, actualEdges: allEdges(secondaryNetwork).length });
    }
  }
}

for (const locale of locales) {
  const reflectUrl = `${baseUrl}/${locale}/api/reflect`;
  const reliable = await fetchJson(reflectUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: reflectPrompt }),
  });
  record(`${locale}: reflect responds 2xx for reliable prompt`, reliable.response.ok, { status: reliable.response.status, url: reflectUrl });
  if (reliable.response.ok && reliable.json) {
    record(`${locale}: reflect returns passage-first payload for reliable prompt`, validateReflectPayload(reliable.json) && reliable.json.state === 'direct' && reliable.json.primary !== null && reliable.json.explanation !== null && omitsLegacyReflectGraphFields(reliable.json), {
      state: reliable.json.state,
      answerMode: reliable.json.meta?.answerMode,
      primary: reliable.json.primary?.reference,
      hasExplanation: Boolean(reliable.json.explanation),
    });
  }

  const low = await fetchJson(reflectUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: lowConfidencePrompt }),
  });
  record(`${locale}: reflect responds 2xx for low-confidence prompt`, low.response.ok, { status: low.response.status, url: reflectUrl });
  if (low.response.ok && low.json) {
    const lowConfidence = low.json.meta?.retrievalConfidence === 'low';
    const passageFirst =
      validateReflectPayload(low.json) &&
      ['tentative', 'unsupported'].includes(low.json.state) &&
      Array.isArray(low.json.relatedPassages) &&
      low.json.relatedPassages.length === 0;
    const asksToClarify = typeof low.json.clarifyPrompt === 'string' && low.json.clarifyPrompt.length > 0;
    record(`${locale}: low-confidence reflect stays passage-first without legacy graph fields`, lowConfidence && passageFirst && asksToClarify && omitsLegacyReflectGraphFields(low.json), {
      state: low.json.state,
      answerMode: low.json.meta?.answerMode,
      confidence: low.json.meta?.retrievalConfidence,
      relatedCount: low.json.relatedPassages?.length ?? null,
      hasClarifyPrompt: asksToClarify,
    });
  }
}

const report = {
  baseUrl,
  reference: referenceSlug,
  secondaryReference: secondaryReferenceSlug,
  expectedCountsFromSourceStores: expected,
  assertions: rows,
  failures,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
