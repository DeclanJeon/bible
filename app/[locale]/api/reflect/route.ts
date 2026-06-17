import { NextResponse } from "next/server";
import { getPassage } from "@/lib/bible";
import { getBookMetadata } from "@/lib/book-metadata";
import { localizeStoryCluster, resolveAppLocale } from "@/lib/content";
import { getPassageCrossReferences } from "@/lib/knowledge";
import { generateReflectionWithHermes } from "@/lib/hermes";
import { buildReflectionResponse } from "@/lib/reflection";
import { getRelatedClusters } from "@/lib/app-data";
import { retrieveClusterForPrompt } from "@/lib/retrieval";
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
  const retrieval = await retrieveClusterForPrompt(normalizedPrompt, appLocale);
  const localizedCluster = localizeStoryCluster(retrieval.cluster, appLocale);
  const primary = await getPassage(localizedCluster.primary, appLocale);
  const graphSuggestions = await getPassageCrossReferences(localizedCluster.primary, 4, appLocale);
  const fallbackLinkedTexts = graphSuggestions.map((suggestion) => ({
    label: suggestion.displayReference,
    type: "theme" as const,
    summary: suggestion.supportLine || suggestion.excerpt,
    reference: suggestion.target,
  }));
  const supportingReferences = localizedCluster.supporting.length
    ? localizedCluster.supporting
    : graphSuggestions.map((suggestion) => suggestion.target);
  const cluster = {
    ...localizedCluster,
    supporting: supportingReferences,
    linkedTexts: localizedCluster.linkedTexts.length ? localizedCluster.linkedTexts : fallbackLinkedTexts,
  };
  const supporting = await Promise.all(cluster.supporting.map((reference) => getPassage(reference, appLocale)));
  const deterministic = await buildReflectionResponse(cluster, normalizedPrompt, appLocale);
  const primaryBookMetadata = getBookMetadata(cluster.primary.code, appLocale);
  const relatedClusters = getRelatedClusters(cluster.slug, 3).map((related) => {
    const localized = localizeStoryCluster(related, appLocale);
    return {
      slug: localized.slug,
      title: localized.title,
      pastoralPrompt: localized.pastoralPrompt,
      starterPrompt: localized.starterPrompt,
      themes: localized.themes,
    };
  });
  let finalResponse;
  if (appLocale === "ko") {
    finalResponse = {
      ...deterministic,
      generationMode: "deterministic" as const,
      generationModel: deterministic.generationModel,
      generationNote: deterministic.generationNote,
    };
  } else {
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
        deterministicReflection: deterministic,
      },
      deterministic,
    );

    finalResponse = {
      ...generation.response,
      generationMode: generation.provider,
      generationModel: generation.model,
      generationNote: generation.note,
    };
  }

  return NextResponse.json({
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
    primary,
    primaryBookMetadata,
    supporting,
    context: cluster.context,
    linkedTexts: cluster.linkedTexts,
    graphSuggestions,
    jesusLayer: cluster.jesusLayer,
    paulLayer: cluster.paulLayer,
    jewishReception: cluster.jewishReception,
    relatedClusters,
    response: finalResponse,
  });
}
