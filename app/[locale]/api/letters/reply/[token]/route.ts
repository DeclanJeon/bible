import { NextResponse } from "next/server";

import { createLetterAnswer } from "@/lib/letters";
import { resolveAppLocale } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  const body = await request.json().catch(() => null) as null | {
    body?: unknown;
    responderNickname?: unknown;
    scriptureRef?: unknown;
  };
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const result = await createLetterAnswer({
    token,
    locale: resolveAppLocale(locale),
    body: body.body,
    responderNickname: body.responderNickname,
    scriptureRef: body.scriptureRef,
    acceptLanguage: request.headers.get("accept-language") ?? undefined,
    countryCode: request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, answerId: result.answer.id, readToken: result.readToken });
}
