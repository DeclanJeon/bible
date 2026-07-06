import { NextResponse } from "next/server";

import { getCardBundle } from "@/lib/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const bundle = await getCardBundle(cardId);
  if (!bundle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, bundle });
}
