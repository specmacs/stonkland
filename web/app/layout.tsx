import type {Metadata, Viewport} from "next";
import {BRAND, EDITION, GLOBAL_DISCLAIMER} from "@/lib/brand";
import {SITE_URL} from "@/lib/config";
import {Header} from "@/components/Header";
import {Footer} from "@/components/Footer";
import {Providers} from "./providers";

import "./globals.css";

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
  themeColor: "#080a0c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 font-sans antialiased">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brass-500 focus:px-3 focus:py-2 focus:text-ink-950"
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
