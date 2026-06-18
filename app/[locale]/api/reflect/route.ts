import { NextResponse } from "next/server";
import { getPassage, serializeBibleReference } from "@/lib/bible";
import { getBookMetadata } from "@/lib/book-metadata";
import { localizeStoryCluster, resolveAppLocale } from "@/lib/content";
import { getPassageCrossReferences } from "@/lib/knowledge";
import { generateReflectionWithHermes } from "@/lib/hermes";
import { buildReflectionResponse } from "@/lib/reflection";
import { getRelatedClustersFromReferences } from "@/lib/app-data";
import { isRetrievalReliable, retrieveClusterForPrompt } from "@/lib/retrieval";
import { buildRagQueryPlan } from "@/lib/rag-query";
import { assessPromptSafety } from "@/lib/safety";

const MAX_PROMPT_LENGTH = 2000;

type ReflectRequestBody = {
  prompt?: string;
};

async function parseReflectRequest(request: Request): Promise<ReflectRequestBody | NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const candidate = body as Record<string, unknown>;
  if (candidate.prompt !== undefined && typeof candidate.prompt !== "string") {
    return NextResponse.json({ error: "prompt must be a string" }, { status: 400 });
  }
  if (typeof candidate.prompt === "string" && candidate.prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: "prompt is too long" }, { status: 400 });
  }

  return {
    prompt: candidate.prompt,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const body = await parseReflectRequest(request);
  if (body instanceof NextResponse) {
    return body;
  }

  const { locale } = await params;
  const requestedLocale = resolveAppLocale(locale);
  const normalizedPrompt =
    body.prompt?.trim() ||
    (requestedLocale === "ko"
      ? "성경 본문을 문맥과 연결 본문으로 공부하고 싶어요."
      : "Help me study a Bible passage with context and linked passages.");
  const safety = assessPromptSafety(normalizedPrompt, {
    requestedLocale,
    acceptLanguage: request.headers.get("accept-language") ?? undefined,
    countryCode: request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? undefined,
  });
  const appLocale = requestedLocale;
  const ragQuery = await buildRagQueryPlan(normalizedPrompt, appLocale);
  const retrieval = await retrieveClusterForPrompt(normalizedPrompt, appLocale, {
    expansionTerms: ragQuery.expansionTerms,
    expansionSummary: ragQuery.expansionSummary ?? undefined,
    expansionProvider: ragQuery.expansionProvider,
  });
  const answerBundle = retrieval.answerBundle ?? null;
  const questionUnderstanding = retrieval.question ?? answerBundle?.question ?? null;
  const hasReliablePrimary = isRetrievalReliable(retrieval);
  const localizedCluster = localizeStoryCluster(retrieval.cluster, appLocale);
  const primaryReference = retrieval.primaryReference;
  const primary = await getPassage(primaryReference, appLocale);
  const graphSuggestions = hasReliablePrimary ? await getPassageCrossReferences(primaryReference, 4, appLocale) : [];
  const fallbackLinkedTexts = graphSuggestions.map((suggestion) => ({
    label: suggestion.displayReference,
    type: "theme" as const,
    summary: suggestion.supportLine || suggestion.excerpt,
    reference: suggestion.target,
  }));
  const supportingReferences = hasReliablePrimary
    ? retrieval.supportingReferences.length
      ? retrieval.supportingReferences
      : localizedCluster.supporting.length
        ? localizedCluster.supporting
        : graphSuggestions.map((suggestion) => suggestion.target)
    : [];
  const cluster = {
    ...localizedCluster,
    primary: primaryReference,
    supporting: supportingReferences,
    linkedTexts: hasReliablePrimary && localizedCluster.linkedTexts.length ? localizedCluster.linkedTexts : fallbackLinkedTexts,
  };
  const supporting = await Promise.all(cluster.supporting.map((reference) => getPassage(reference, appLocale)));
  const deterministic = await buildReflectionResponse(cluster, normalizedPrompt, appLocale, {
    retrieval,
    graphSuggestions,
    primaryReference,
    supportingReferences,
  });
  const primaryBookMetadata = getBookMetadata(primaryReference.code, appLocale);
  const relatedCodes = [
    primaryReference.code,
    ...supportingReferences.map((reference) => reference.code),
    ...graphSuggestions.map((suggestion) => suggestion.target.code),
  ];
  const relatedClusters = hasReliablePrimary
    ? getRelatedClustersFromReferences(cluster.slug, relatedCodes, 3).map((related) => {
        const localized = localizeStoryCluster(related, appLocale);
        return {
          slug: localized.slug,
          title: localized.title,
          pastoralPrompt: localized.pastoralPrompt,
          starterPrompt: localized.starterPrompt,
          themes: localized.themes,
        };
      })
    : [];
  const crossReferenceNetworkUrl = hasReliablePrimary ? `/${appLocale}/crossrefs/${serializeBibleReference(primaryReference)}` : null;
  const allowedEvidenceIds = ["primary", ...supportingReferences.map((_, index) => `supporting-${index}`)];
  const generation = await generateReflectionWithHermes(
    {
      prompt: normalizedPrompt,
      safety,
      retrieval,
      cluster: {
        slug: cluster.slug,
        title: cluster.title,
        themes: cluster.themes,
        emotions: cluster.emotions,
        pastoralPrompt: cluster.pastoralPrompt,
        reflectionQuestions: cluster.reflectionQuestions,
      },
      primaryBookMetadata,
      linkedTexts: cluster.linkedTexts,
      context: cluster.context,
      jesusLayer: cluster.jesusLayer,
      paulLayer: cluster.paulLayer,
      jewishReception: cluster.jewishReception,
      graphSuggestions,
      crossReferenceSummary: null,
      crossReferenceHighlights: [],
      crossReferenceNetworkUrl,
      allowedEvidenceIds,
      deterministicReflection: deterministic,
    },
    deterministic,
  );

  const finalResponse = {
    ...generation.response,
    generationMode: generation.provider,
    generationModel: generation.model,
    generationNote: generation.note,
    answerPolicy: questionUnderstanding?.answerMode,
    questionUnderstanding,
  };

  return NextResponse.json({
    prompt: normalizedPrompt,
    safety,
    retrieval,
    ragQuery,
    answerBundle,
    doctrinePresentation: answerBundle?.doctrinePresentation,
    questionUnderstanding,
    cluster: {
      slug: cluster.slug,
      title: cluster.title,
      themes: cluster.themes,
      emotions: cluster.emotions,
      pastoralPrompt: cluster.pastoralPrompt,
      reflectionQuestions: cluster.reflectionQuestions,
    },
    primary,
    primaryBookMetadata,
    supporting,
    context: cluster.context,
    linkedTexts: cluster.linkedTexts,
    graphSuggestions,
    crossReferenceSummary: null,
    crossReferenceHighlights: [],
    crossReferenceNetworkUrl,
    jesusLayer: cluster.jesusLayer,
    paulLayer: cluster.paulLayer,
    jewishReception: cluster.jewishReception,
    relatedClusters,
    response: finalResponse,
  });
}
