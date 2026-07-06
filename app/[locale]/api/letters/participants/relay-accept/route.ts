import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { acceptRelayParticipation } from "@/lib/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "letters_participant_session";

export async function POST() {
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  const result = await acceptRelayParticipation(sessionToken);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.error === "not-authenticated" ? 401 : 400 });
  }
  return NextResponse.json(result);
}
