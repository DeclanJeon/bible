import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_DIR = join(process.cwd(), ".data", "letter-card-images");

export async function GET(_request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const safeCardId = cardId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeCardId) {
    return NextResponse.json({ error: "Invalid card ID" }, { status: 400 });
  }

  const imagePath = join(IMAGE_DIR, `${safeCardId}.png`);
  try {
    await stat(imagePath);
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const imageBuffer = await readFile(imagePath);
  return new NextResponse(imageBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
