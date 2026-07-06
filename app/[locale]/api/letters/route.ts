import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createAnonymousLetter, getLetterParticipantAuthor } from "@/lib/letters";
import { resolveAppLocale } from "@/lib/content";


const SESSION_COOKIE = "letters_participant_session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LetterRequestBody = {
  body?: unknown;
  authorEmail?: unknown;
  authorNickname?: unknown;
  category?: unknown;
  shareVisibility?: unknown;
};

async function parseBody(request: Request): Promise<LetterRequestBody | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }
  return body as LetterRequestBody;
}

export async function POST(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const parsed = await parseBody(request);
  if (parsed instanceof NextResponse) {
    return parsed;
  }
  const { locale } = await params;
  const session = await getLetterParticipantAuthor((await cookies()).get(SESSION_COOKIE)?.value ?? null);
  const authorEmail = parsed.authorEmail ?? session?.email;
  const authorNickname = parsed.authorNickname ?? session?.nickname;
  const result = await createAnonymousLetter({
    locale: resolveAppLocale(locale),
    body: parsed.body,
    authorEmail,
    authorNickname,
    category: parsed.category,
    shareVisibility: parsed.shareVisibility,
    acceptLanguage: request.headers.get("accept-language") ?? undefined,
    countryCode: request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? undefined,
    scheduleDispatch: after,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, letterId: result.bundle?.letter.id, cardId: result.bundle?.card?.id, bundle: result.bundle });
}
