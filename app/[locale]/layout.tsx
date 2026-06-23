import { GlobalNavShell } from "@/components/global-nav-shell";
import { PassagePanelProvider } from "@/components/passage-panel";
import { PwaExperience } from "@/components/pwa-experience";
import { notFound } from "next/navigation";

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (locale !== "ko" && locale !== "en") {
    notFound();
  }

  return (
    <PassagePanelProvider locale={locale}>
      <GlobalNavShell locale={locale} />
      <PwaExperience locale={locale} />
      {children}
    </PassagePanelProvider>
  );
}
