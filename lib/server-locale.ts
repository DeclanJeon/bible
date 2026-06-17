import { resolveAppLocale, type AppLocale } from "@/lib/content";

export async function resolveLocale(requestedLocale?: string): Promise<AppLocale> {
  return resolveAppLocale(requestedLocale);
}
