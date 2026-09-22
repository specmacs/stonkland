import type {Metadata, Viewport} from "next";
import {Inter, Inter_Tight, IBM_Plex_Mono} from "next/font/google";
import {BRAND, EDITION, GLOBAL_DISCLAIMER} from "@/lib/brand";
import {SITE_URL} from "@/lib/config";
import {Header} from "@/components/Header";
import {Footer} from "@/components/Footer";
import {Providers} from "./providers";

import "./globals.css";

/* Inter Tight carries the headlines, Inter the prose, IBM Plex Mono every number. */
const display = Inter_Tight({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  title: {
    default: `${BRAND.projectName} · ${BRAND.strapline}`,
    template: `%s · ${BRAND.projectName}`,
  },
  description: `${EDITION.cardSupply} ${BRAND.itemName.toLowerCase()}s, and never more. ${GLOBAL_DISCLAIMER}`,
  openGraph: {
    title: BRAND.projectName,
    description: BRAND.strapline,
    type: "website",
  },
  twitter: {card: "summary_large_image"},
};

export const viewport: Viewport = {
  themeColor: "#c9ddd4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-tabletop font-sans antialiased">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border-rule focus:border-ink focus:bg-paper focus:px-3 focus:py-2 focus:text-ink"
          >
            Skip to content
          </a>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
