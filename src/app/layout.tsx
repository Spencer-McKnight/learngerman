import type { Metadata, Viewport } from "next";
import { Barlow, Inter } from "next/font/google";
import { PrefsBoot } from "@/components/prefs-boot";
import "./globals.css";

// DIN-flavoured display face for headings and numbers; humanist body face
// with room to breathe — German text runs long and compound-heavy.
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
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#16181d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PrefsBoot />
        {children}
      </body>
    </html>
  );
}
