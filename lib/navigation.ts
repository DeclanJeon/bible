type LocaleInput = string | null | undefined;

type SearchValue = string | null | undefined;

type BibleReferenceInput = {
  code: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

function serializeReference(reference: BibleReferenceInput) {
  return `${reference.code}-${reference.chapter}-${reference.startVerse}-${reference.endVerse}`;
}

function serializeHighlight(reference: BibleReferenceInput) {
  return reference.startVerse === reference.endVerse
    ? String(reference.startVerse)
    : `${reference.startVerse}-${reference.endVerse}`;
}

function normalizeBookCode(value: SearchValue) {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[0-9A-Z]{3}$/.test(normalized) ? normalized : null;
}

function normalizeChapter(value: number | string | null | undefined) {
  if (value === undefined || value === null) return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value).trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : null;
}

function normalizeHighlight(value: SearchValue) {
  const normalized = value?.trim();
  return normalized && /^\d+(?:-\d+)?$/.test(normalized) ? normalized : null;
}

function normalizeSourceTag(value: SearchValue) {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-z0-9-]{1,32}$/.test(normalized) ? normalized : null;
}

function appendIfPresent(params: URLSearchParams, key: string, value: SearchValue) {
  const normalized = value?.trim();
  if (normalized) {
    params.set(key, normalized);
  }
}

function normalizeLocale(locale: LocaleInput) {
  return locale === "en" ? "en" : "ko";
}

function localizedPath(locale: LocaleInput, path: string) {
  return `/${normalizeLocale(locale)}${path}`;
}

function withQuery(path: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function buildCompanionHref(options: { prompt?: SearchValue; locale?: LocaleInput } = {}) {
  const params = new URLSearchParams();
  appendIfPresent(params, "prompt", options.prompt);
  return withQuery(localizedPath(options.locale, "/companion"), params);
}

export function buildStudyHref(slug: string, locale?: LocaleInput) {
  const params = new URLSearchParams();
  return withQuery(localizedPath(locale, `/study/${slug}`), params);
}

export function buildGraphHref(slug: string, locale?: LocaleInput) {
  const params = new URLSearchParams();
  return withQuery(localizedPath(locale, `/graph/${slug}`), params);
}

export function buildPassageHref(reference: BibleReferenceInput, locale?: LocaleInput) {
  const params = new URLSearchParams();
  return withQuery(localizedPath(locale, `/passage/${serializeReference(reference)}`), params);
}

export function buildBibleHref(options: {
  book?: SearchValue;
  chapter?: number | string | null;
  highlight?: SearchValue;
  from?: SearchValue;
  locale?: LocaleInput;
} = {}) {
  const params = new URLSearchParams();
  const normalizedBook = normalizeBookCode(options.book);
  const normalizedChapter = normalizeChapter(options.chapter);
  const normalizedHighlight = normalizeHighlight(options.highlight);
  const normalizedFrom = normalizeSourceTag(options.from);
  appendIfPresent(params, "book", normalizedBook);
  appendIfPresent(params, "chapter", normalizedChapter);
  appendIfPresent(params, "highlight", normalizedHighlight);
  appendIfPresent(params, "from", normalizedFrom);
  return withQuery(localizedPath(options.locale, "/bible"), params);
}

export function buildBibleReferenceHref(
  reference: BibleReferenceInput,
  options: { locale?: LocaleInput; from?: SearchValue } = {},
) {
  return buildBibleHref({
    book: reference.code,
    chapter: reference.chapter,
    highlight: serializeHighlight(reference),
    from: options.from,
    locale: options.locale,
  });
}

export function buildLanesHref(options: { topic?: SearchValue; q?: SearchValue; locale?: LocaleInput } = {}) {
  const params = new URLSearchParams();
  appendIfPresent(params, "topic", options.topic);
  appendIfPresent(params, "q", options.q);
  return withQuery(localizedPath(options.locale, "/lanes"), params);
}

export function buildReviewsHref(locale?: LocaleInput) {
  return localizedPath(locale, "/reviews");
}
