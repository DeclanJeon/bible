import { NextResponse } from "next/server";
import { buildFaithQuestionAnswer } from "@/lib/faith-question-answer";

const MAX_QUERY_LENGTH = 1000;

type FaithQuestionRequest = {
  query?: string;
  locale?: string;
};

function parseLocale(value: unknown) {
  return value === "en" ? "en" : "ko";
}

async function parseRequestBody(request: Request): Promise<FaithQuestionRequest | NextResponse> {
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
  if (candidate.query !== undefined && typeof candidate.query !== "string") {
    return NextResponse.json({ error: "query must be a string" }, { status: 400 });
  }
  if (candidate.locale !== undefined && typeof candidate.locale !== "string") {
    return NextResponse.json({ error: "locale must be a string" }, { status: 400 });
  }
  if (!candidate.query?.toString().trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  if (typeof candidate.query === "string" && candidate.query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "query is too long" }, { status: 400 });
  }

  return {
    query: candidate.query as string,
    locale: parseLocale(candidate.locale),
  };
}

export async function POST(request: Request) {
  const body = await parseRequestBody(request);
  if (body instanceof NextResponse) {
    return body;
  }

  const answer = await buildFaithQuestionAnswer({
    query: body.query ?? "",
    locale: body.locale,
    acceptLanguage: request.headers.get("accept-language"),
    countryCode: request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry"),
  });

  return NextResponse.json(answer);
}
