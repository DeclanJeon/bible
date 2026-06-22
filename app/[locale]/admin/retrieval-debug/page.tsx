import Link from "next/link";
import { notFound } from "next/navigation";
import { getBibleRuntimeStatus, getPassage, type BibleVerse, type BookMeta } from "@/lib/bible";
import { getBookMetadata, type BookMetadata } from "@/lib/book-metadata";
import { getPassageIndexRuntimeStatus } from "@/lib/bible-passage-index";
import { APP_SOURCES, getRelatedClustersFromReferences } from "@/lib/app-data";
import { localizeSourceLinks, localizeStoryCluster, resolveAppLocale } from "@/lib/content";
import { getCrossReferenceRuntimeStatus, getPassageCrossReferences, type CrossReferenceSuggestion } from "@/lib/knowledge";
import { buildReflectionResponse, type ReflectionResponse } from "@/lib/reflection";
import { retrieveClusterForPrompt, type RetrievalResult } from "@/lib/retrieval";
import { resolveLocale } from "@/lib/server-locale";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; prompt?: string }>;
};

type PassageDebug = {
  book: BookMeta | undefined;
  reference: string;
  verses: BibleVerse[];
};

type RetrievalDebugData = {
  retrieval: RetrievalResult;
  primary: PassageDebug;
  supporting: PassageDebug[];
  graphSuggestions: CrossReferenceSuggestion[];
  relatedClusters: Array<{ slug: string; title: string }>;
  reflection: ReflectionResponse;
  primaryBookMetadata: BookMetadata | undefined;
  runtime: {
    bible: ReturnType<typeof getBibleRuntimeStatus>;
    passageIndex: ReturnType<typeof getPassageIndexRuntimeStatus>;
    crossrefs: ReturnType<typeof getCrossReferenceRuntimeStatus>;
  };
};

export default async function RetrievalDebugPage({ params, searchParams }: Props) {
  const [{ locale: requestedLocale }, { token, prompt }] = await Promise.all([params, searchParams]);
  const locale = await resolveLocale(requestedLocale);
  const expectedToken = process.env.ADMIN_DEBUG_TOKEN;

  if (!expectedToken || token !== expectedToken) {
    notFound();
  }

  const appLocale = resolveAppLocale(locale);
  const sources = localizeSourceLinks(APP_SOURCES, appLocale);
  const normalizedPrompt = prompt?.trim() ?? "";

  let debug: RetrievalDebugData | null = null;

  if (normalizedPrompt) {
    const retrieval = await retrieveClusterForPrompt(normalizedPrompt, appLocale);
    const localizedCluster = localizeStoryCluster(retrieval.cluster, appLocale);
    const primaryReference = retrieval.primaryReference;
    const primary = await getPassage(primaryReference, appLocale);
    const graphSuggestions = await getPassageCrossReferences(primaryReference, 8, appLocale);
    const supportingReferences = retrieval.supportingReferences.length
      ? retrieval.supportingReferences
      : localizedCluster.supporting.length
        ? localizedCluster.supporting
        : graphSuggestions.map((suggestion) => suggestion.target);
    const cluster = {
      ...localizedCluster,
      primary: primaryReference,
      supporting: supportingReferences,
    };
    const supporting = await Promise.all(cluster.supporting.map((reference) => getPassage(reference, appLocale)));
    const reflection = await buildReflectionResponse(cluster, normalizedPrompt, appLocale, {
      retrieval,
      graphSuggestions,
      primaryReference,
      supportingReferences,
    });
    const relatedCodes = [
      primaryReference.code,
      ...supportingReferences.map((reference) => reference.code),
      ...graphSuggestions.map((suggestion) => suggestion.target.code),
    ];
    const relatedClusters = getRelatedClustersFromReferences(cluster.slug, relatedCodes, 6).map((related) => ({
      slug: related.slug,
      title: localizeStoryCluster(related, appLocale).title,
    }));

    const runtime = {
      bible: getBibleRuntimeStatus(),
      passageIndex: getPassageIndexRuntimeStatus(),
      crossrefs: getCrossReferenceRuntimeStatus(),
    };
    debug = {
      retrieval,
      primary,
      supporting,
      graphSuggestions,
      relatedClusters,
      reflection,
      primaryBookMetadata: getBookMetadata(primaryReference.code, appLocale),
      runtime,
    };
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 lg:px-8">
      <section className="glass rounded-2xl p-6 lg:p-8">
        <div className="section-title">Admin retrieval debug</div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--ink)]">Prompt inspection</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Hidden debug page for inspecting retrieval score, supporting passages, graph suggestions, and deterministic reflection output.
        </p>
        <form className="mt-6 space-y-3" method="get">
          <input type="hidden" name="token" value={expectedToken} />
          <textarea
            name="prompt"
            defaultValue={normalizedPrompt}
            rows={4}
            className="w-full rounded-lg border border-[var(--hairline-strong)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--ink)] outline-none"
            placeholder="Enter a prompt to inspect retrieval"
          />
          <button className="inline-flex min-h-[44px] items-center rounded-lg bg-[var(--gold)] px-5 py-3 text-sm font-semibold text-[var(--canvas)]">
            Run debug
          </button>
        </form>
      </section>

      {debug ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="glass rounded-2xl p-6">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">Retrieval</h2>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--hairline)] bg-[var(--surface-2)] p-4 text-xs leading-6 text-[var(--ink)]">{JSON.stringify(debug.retrieval, null, 2)}</pre>
          </section>
          <section className="glass rounded-2xl p-6">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">Runtime sources</h2>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--hairline)] bg-[var(--surface-2)] p-4 text-xs leading-6 text-[var(--ink)]">{JSON.stringify(debug.runtime, null, 2)}</pre>
          </section>
          <section className="glass rounded-2xl p-6">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">Primary & supporting</h2>
            <div className="mt-4 space-y-4 text-sm text-[var(--ink)]">
              <div>
                <div className="text-[var(--gold)]">Primary</div>
                <div className="mt-1">{debug.primary.reference}</div>
              </div>
              <div>
                <div className="text-[var(--gold)]">Supporting</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {debug.supporting.map((passage) => (
                    <li key={passage.reference}>{passage.reference}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[var(--gold)]">Related lanes</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {debug.relatedClusters.map((cluster) => (
                    <li key={cluster.slug}>{cluster.slug} — {cluster.title}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
          <section className="glass rounded-2xl p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">Graph suggestions</h2>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--hairline)] bg-[var(--surface-2)] p-4 text-xs leading-6 text-[var(--ink)]">{JSON.stringify(debug.graphSuggestions, null, 2)}</pre>
          </section>
          <section className="glass rounded-2xl p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">Deterministic reflection</h2>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--hairline)] bg-[var(--surface-2)] p-4 text-xs leading-6 text-[var(--ink)]">{JSON.stringify(debug.reflection, null, 2)}</pre>
          </section>
          <section className="glass rounded-2xl p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">Source links</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[var(--ink)]">
              {sources.map((source) => (
                <li key={source.url}>
                  <Link className="source-link" href={source.url} target="_blank" rel="noreferrer">{source.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </main>
  );
}
