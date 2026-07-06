import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { unsubscribeLetterParticipant } from "@/lib/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "letters_participant_session";

type UnsubscribeBody = { token?: unknown };

async function parseBody(request: Request): Promise<UnsubscribeBody | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {};
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Request body must be an object" }, { status: 400 });
  }
  return body as UnsubscribeBody;
}

export async function POST(request: Request) {
  const parsed = await parseBody(request);
  if (parsed instanceof NextResponse) {
    return parsed;
  }
  const cookieStore = await cookies();
  const result = await unsubscribeLetterParticipant({
    sessionToken: cookieStore.get(SESSION_COOKIE)?.value ?? null,
    token: typeof parsed.token === "string" ? parsed.token : null,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: result.error === "invalid-token" ? 404 : 401 });
  }
  const response = NextResponse.json(result);
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
