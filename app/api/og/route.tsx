import { ImageResponse } from "next/og";

export const runtime = "edge";

const SITE_NAME = "Bible Hyperlink Companion";
const MAX_TITLE_LENGTH = 68;
const MAX_DESCRIPTION_LENGTH = 140;

function cleanText(value: string | null, fallback: string, maxLength: number) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim() || fallback;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") === "en" ? "en" : "ko";
  const title = cleanText(searchParams.get("title"), locale === "ko" ? "성경 길찾기" : "Bible Guidance", MAX_TITLE_LENGTH);
  const description = cleanText(
    searchParams.get("description"),
    locale === "ko"
      ? "본문과 맥락, 성도 간 말씀의 위로를 연결합니다."
      : "Connect Scripture, context, and Scripture-rooted comfort.",
    MAX_DESCRIPTION_LENGTH,
  );
  const path = cleanText(searchParams.get("path"), locale === "ko" ? "/ko" : "/en", 48);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #fffaf0 0%, #f7efe0 48%, #ead6ad 100%)",
          color: "#271d13",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              color: "#8a6425",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: 999, background: "#c79a41" }} />
            {SITE_NAME}
          </div>
          <div style={{ color: "#8a6425", fontSize: 24, fontWeight: 700 }}>{path}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "28px", maxWidth: 930 }}>
          <div style={{ fontSize: 78, lineHeight: 1.12, fontWeight: 900, letterSpacing: "-0.04em" }}>{title}</div>
          <div style={{ maxWidth: 860, color: "#5f5142", fontSize: 34, lineHeight: 1.45, fontWeight: 600 }}>{description}</div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "2px solid rgba(138,100,37,0.24)",
            paddingTop: "28px",
            color: "#8a6425",
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          <span>{locale === "ko" ? "성경 본문 · 맥락 · 말씀편지" : "Scripture · Context · Light Relay"}</span>
          <span>bible.ponslink.com</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
