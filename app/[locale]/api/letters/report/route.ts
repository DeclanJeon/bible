import { NextResponse } from "next/server";

import { reportLetterTarget } from "@/lib/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function parseReport(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json().catch(() => null) as Promise<unknown>;
  }
  const form = await request.formData();
  return {
    targetType: form.get("targetType"),
    targetId: form.get("targetId"),
    reason: form.get("reason"),
  };
}

export async function POST(request: Request) {
  const body = await parseReport(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }
  const candidate = body as Record<string, unknown>;
  const result = await reportLetterTarget({ targetType: candidate.targetType, targetId: candidate.targetId, reason: candidate.reason });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
