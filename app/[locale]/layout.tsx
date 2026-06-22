import { PassagePanelProvider } from "@/components/passage-panel";
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

  return <PassagePanelProvider locale={locale}>{children}</PassagePanelProvider>;
}
