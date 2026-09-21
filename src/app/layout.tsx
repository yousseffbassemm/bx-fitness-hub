import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

/**
 * Archivo carries a width axis, which lets the display type sit at the
 * narrow, engineered weight BX uses across its posters (see .font-display).
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#08090a",
};

/**
 * Only the document shell lives here. The marketing chrome - navbar, footer,
 * phone bar, structured data - belongs to the (site) group, so /staff can
 * render without any of it.
 */
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "BX Fitness Hub | Gym in New Cairo",
    template: `%s | ${site.name}`,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-ink">{children}</body>
    </html>
  );
}
