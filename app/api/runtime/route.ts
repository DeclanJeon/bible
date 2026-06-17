import { NextResponse } from "next/server";
import { resolveEmbeddingProviderConfig } from "@/lib/embeddings";
import { resolveHermesProviderConfig } from "@/lib/hermes";


export async function GET() {
  const hermes = await resolveHermesProviderConfig();
  const embeddings = await resolveEmbeddingProviderConfig();

  return NextResponse.json({
    hermes: {
      ready: hermes.ready,
    },
    embeddings: {
      ready: embeddings.ready,
    },
  });
}
