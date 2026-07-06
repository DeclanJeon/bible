import { NextResponse } from "next/server";

import { verifyLetterParticipantOtp } from "@/lib/letters";

const SESSION_COOKIE = "letters_participant_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyOtpBody = {
  email?: unknown;
  otp?: unknown;
};

async function parseBody(request: Request): Promise<VerifyOtpBody | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Request body must be an object" }, { status: 400 });
  }
  return body as VerifyOtpBody;
}

function statusForError(error: string) {
  if (error === "invalid-otp" || error === "otp-attempt-limit") {
    return 401;
  }
  return 400;
}

export async function POST(request: Request) {
  const parsed = await parseBody(request);
  if (parsed instanceof NextResponse) {
    return parsed;
  }
  const result = await verifyLetterParticipantOtp({ email: parsed.email, otp: parsed.otp });
  if (!result.ok) {
    return NextResponse.json(result, { status: statusForError(result.error) });
  }
  const response = NextResponse.json({ ok: true, participant: result.participant });
  response.cookies.set(SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: new Date(result.sessionTokenExpiresAt),
  });
  return response;
}
