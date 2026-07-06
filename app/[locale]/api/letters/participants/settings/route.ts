import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getLetterParticipantSession, updateLetterParticipantSettings } from "@/lib/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "letters_participant_session";

type SettingsBody = {
  canReceiveLetters?: unknown;
  nickname?: unknown;
  pauseDays?: unknown;
  preferredLocale?: unknown;
  maxLettersPerDay?: unknown;
};

async function sessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

async function parseBody(request: Request): Promise<SettingsBody | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Request body must be an object" }, { status: 400 });
  }
  return body as SettingsBody;
}

function statusForError(error: string) {
  return error === "not-authenticated" ? 401 : 400;
}

export async function GET() {
  const participant = await getLetterParticipantSession(await sessionToken());
  if (!participant) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, participant });
}

export async function POST(request: Request) {
  const parsed = await parseBody(request);
  if (parsed instanceof NextResponse) {
    return parsed;
  }
  const result = await updateLetterParticipantSettings({
    sessionToken: await sessionToken(),
    canReceiveLetters: parsed.canReceiveLetters,
    nickname: parsed.nickname,
    pauseDays: parsed.pauseDays,
    preferredLocale: parsed.preferredLocale,
    maxLettersPerDay: parsed.maxLettersPerDay,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: statusForError(result.error) });
  }
  return NextResponse.json(result);
}
