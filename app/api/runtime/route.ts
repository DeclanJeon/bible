import { NextResponse } from "next/server";
import { getBibleRuntimeStatus } from "@/lib/bible";
import { getPassageIndexRuntimeStatus } from "@/lib/bible-passage-index";
import { getEmbeddingProviderRuntimeStatus } from "@/lib/embeddings";
import { getHermesProviderRuntimeStatus } from "@/lib/hermes";
import { getCrossReferenceRuntimeStatus } from "@/lib/knowledge";

export function GET() {
  return NextResponse.json({
    hermes: getHermesProviderRuntimeStatus(),
    embeddings: getEmbeddingProviderRuntimeStatus(),
    runtime: {
      bible: getBibleRuntimeStatus(),
      passageIndex: getPassageIndexRuntimeStatus(),
      crossrefs: getCrossReferenceRuntimeStatus(),
    },
  });
}
