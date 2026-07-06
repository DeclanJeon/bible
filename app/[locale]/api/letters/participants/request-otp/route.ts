import { NextResponse } from "next/server";

import { requestLetterParticipantOtp } from "@/lib/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestOtpBody = {
  email?: unknown;
  nickname?: unknown;
  canReceiveLetters?: unknown;
};

async function parseBody(request: Request): Promise<RequestOtpBody | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Request body must be an object" }, { status: 400 });
  }
  return body as RequestOtpBody;
}

function statusForError(error: string) {
  if (error === "otp-resend-too-soon" || error === "otp-request-limit") {
    return 429;
  }
  if (error === "email-failed") {
    return 502;
  }
  return 400;
}

export async function POST(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const parsed = await parseBody(request);
  if (parsed instanceof NextResponse) {
    return parsed;
  }
  const { locale } = await params;
  const result = await requestLetterParticipantOtp({
    locale,
    email: parsed.email,
    nickname: parsed.nickname,
    canReceiveLetters: parsed.canReceiveLetters,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: statusForError(result.error) });
  }
  return NextResponse.json(result);
}
