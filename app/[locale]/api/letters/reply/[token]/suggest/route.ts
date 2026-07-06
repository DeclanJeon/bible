import { NextResponse } from "next/server";

import { suggestReplyScriptures } from "@/lib/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ locale: string; token: string }> }) {
  const { token } = await params;
  const result = await suggestReplyScriptures(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, suggestions: result.suggestions });
}
