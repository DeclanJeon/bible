import { NextResponse } from "next/server";

import { updateCardVisibility, type LetterVisibility } from "@/lib/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const body = await request.json().catch(() => ({})) as { visibility?: unknown };
  const visibility: LetterVisibility = body.visibility === "public" || body.visibility === "unlisted" ? body.visibility : "private";
  const result = await updateCardVisibility(cardId, visibility);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true, card: result.card });
}
