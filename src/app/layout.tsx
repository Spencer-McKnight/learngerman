import type { Metadata, Viewport } from "next";
import { Barlow, Inter } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { PrefsBoot } from "@/components/prefs-boot";
import { getUiLang } from "@/lib/i18n/server";
import "./globals.css";

/* Wegweiser type: Barlow (DIN-flavoured) for display, numbers and station
 * names; Inter for body. Both self-hosted by next/font, swapped in without
 * layout shift via size-adjusted fallbacks. */
const display = Barlow({
  variable: "--font-barlow",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const body = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
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
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#16181d" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const uiLang = await getUiLang();
  return (
    <html
      lang="en"
      translate="no"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-ground font-sans text-ink">
        <PrefsBoot />
        <I18nProvider lang={uiLang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
