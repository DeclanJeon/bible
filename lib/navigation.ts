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
export function buildBibleHref(options: { book?: SearchValue; chapter?: number | string | null; locale?: LocaleInput } = {}) {
  const params = new URLSearchParams();
  appendIfPresent(params, "book", options.book);
  if (options.chapter !== undefined && options.chapter !== null) {
    appendIfPresent(params, "chapter", String(options.chapter));
  }
  return withQuery(localizedPath(options.locale, "/bible"), params);
}

export function buildLanesHref(options: { topic?: SearchValue; q?: SearchValue; locale?: LocaleInput } = {}) {
  const params = new URLSearchParams();
  appendIfPresent(params, "topic", options.topic);
  appendIfPresent(params, "q", options.q);
  return withQuery(localizedPath(options.locale, "/lanes"), params);
}
