import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getLetterParticipantHistory } from "@/lib/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "letters_participant_session";

export async function GET() {
  const history = await getLetterParticipantHistory((await cookies()).get(SESSION_COOKIE)?.value ?? null);
  if (!history) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, history });
}
