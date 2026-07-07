import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { getStoredCardImageUrl } from "@/lib/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_DIR = join(process.cwd(), ".data", "letter-card-images");
const DEFAULT_REMOTE_IMAGE_HOSTS = new Set([
  "drive.google.com",
  "drive.usercontent.google.com",
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
]);

function configuredRemoteImageHosts() {
  const hosts = new Set(DEFAULT_REMOTE_IMAGE_HOSTS);
  const configuredHosts = process.env.LETTERS_CARD_IMAGE_PROXY_HOSTS
    ?.split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean) ?? [];
  for (const host of configuredHosts) {
    hosts.add(host);
  }
  return hosts;
}

function remoteCardImageUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !configuredRemoteImageHosts().has(url.hostname.toLowerCase())) {
    return null;
  }
  return url;
}

async function proxyRemoteCardImage(imageUrl: string) {
  const url = remoteCardImageUrl(imageUrl);
  if (!url) {
    return null;
  }

  const response = await fetch(url, { redirect: "follow" });
  if (response.url && !remoteCardImageUrl(response.url)) {
    return NextResponse.json({ error: "Remote image redirect was not allowed" }, { status: 502 });
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().startsWith("image/") || !response.body) {
    return NextResponse.json({ error: "Remote image not available" }, { status: 502 });
  }

  return new NextResponse(response.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}


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
    const remoteImageUrl = await getStoredCardImageUrl(safeCardId);
    const proxiedImage = remoteImageUrl ? await proxyRemoteCardImage(remoteImageUrl) : null;
    return proxiedImage ?? NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const imageBuffer = await readFile(imagePath);
  return new NextResponse(imageBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
