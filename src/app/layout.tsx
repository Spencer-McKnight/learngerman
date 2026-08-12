import type { Metadata, Viewport } from "next";
import { Barlow, Inter } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { PrefsBoot } from "@/components/prefs-boot";
import { getUiLang } from "@/lib/i18n/server";
import "./globals.css";

const display = Barlow({
  variable: "--font-display",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Learn German",
    template: "%s · Learn German",
  },
  description:
    "An adaptive German tutor: comprehensible input at your exact level, honest progress, real spoken German.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Learn German",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1eb" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const uiLang = await getUiLang();
  return (
    <html
      lang="en"
      translate="no"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PrefsBoot />
        <I18nProvider lang={uiLang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
