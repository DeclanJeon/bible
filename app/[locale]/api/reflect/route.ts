import { NextResponse } from "next/server";
import { resolveAppLocale } from "@/lib/content";
import { buildPassageRecommendation } from "@/lib/passage-response";

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
  const fallbackPrompt =
    requestedLocale === "ko"
      ? "성경 본문을 문맥과 연결 본문으로 공부하고 싶어요."
      : "Help me study a Bible passage with context and linked passages.";

  const build = await buildPassageRecommendation(body.prompt?.trim() || fallbackPrompt, {
    locale: requestedLocale,
    acceptLanguage: request.headers.get("accept-language") ?? undefined,
    countryCode: request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? undefined,
    includeRelatedPassageDetails: false,
    includeExternalResources: false,
  });

  return NextResponse.json({
    ...build.recommendation,
    safety: build.safety,
    questionUnderstanding: build.questionUnderstanding,
    ragQuery: build.ragQuery,
    meta: {
      retrievalConfidence: build.retrieval.confidence,
      retrievalMode: build.retrieval.retrievalMode,
      retrievalScore: build.retrieval.score,
      passageScore: build.retrieval.passageScore,
      answerMode: build.questionUnderstanding.answerMode,
      hasAnswerBundle: Boolean(build.answerBundle),
      hasYoutubeResources: (build.recommendation.externalResources?.youtube ?? build.recommendation.background?.youtubeResources ?? []).length > 0,
    },
  });
}
