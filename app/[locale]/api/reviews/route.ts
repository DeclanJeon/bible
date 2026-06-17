import { NextResponse } from "next/server";
import { resolveAppLocale } from "@/lib/content";
import { createAnonymousReview, listAnonymousReviews } from "@/lib/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_POSTS_PER_WINDOW = 5;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const bucket = rateLimits.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  bucket.count += 1;
  return bucket.count > MAX_POSTS_PER_WINDOW;
}

async function parseBody(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const reviews = await listAnonymousReviews(locale, 50);
  return NextResponse.json({ reviews });
}

export async function POST(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  if (isRateLimited(clientKey(request))) {
    return NextResponse.json({ error: "Too many reviews. Try again in a minute." }, { status: 429 });
  }

  const body = await parseBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  }

  const { locale } = await params;
  const result = await createAnonymousReview({ locale: resolveAppLocale(locale), body: body.body });
  if (!result.ok) {
    return NextResponse.json({ error: "Review must be 10-1200 characters." }, { status: 400 });
  }

  return NextResponse.json({ review: result.review }, { status: 201 });
}
