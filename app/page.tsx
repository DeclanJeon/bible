import { headers } from "next/headers";
import { redirect } from "next/navigation";

function localeFromAcceptLanguage(acceptLanguage: string | null) {
  const preferredLocale = acceptLanguage
    ?.split(",")
    .map((entry) => {
      const [tag, ...parameters] = entry.split(";");
      const quality = parameters
        .map((parameter) => parameter.trim().match(/^q=([0-9.]+)$/)?.[1])
        .find(Boolean);
      return {
        tag: tag?.trim().toLowerCase() ?? "",
        quality: quality ? Number(quality) : 1,
      };
    })
    .filter(({ tag, quality }) => tag && Number.isFinite(quality) && quality > 0)
    .sort((left, right) => right.quality - left.quality)
    .find(({ tag }) => tag === "ko" || tag.startsWith("ko-") || tag === "en" || tag.startsWith("en-"));

  return preferredLocale?.tag === "en" || preferredLocale?.tag.startsWith("en-") ? "en" : "ko";
}

export default async function RootPage() {
  const requestHeaders = await headers();
  redirect(`/${localeFromAcceptLanguage(requestHeaders.get("accept-language"))}`);
}
