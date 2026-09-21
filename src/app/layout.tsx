import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import Footer from "@/components/Footer";
import HashScroll from "@/components/HashScroll";
import MobileBar from "@/components/MobileBar";
import Navbar from "@/components/Navbar";
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

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "BX Fitness Hub | Gym in New Cairo",
    template: `%s | ${site.name}`,
  },
  description:
    "BX Fitness Hub is a gym in New Cairo open 6AM to 1AM every day. Strength and cardio floors, 15 classes a week open to members and non-members, personal training, recovery and spa.",
  keywords: [
    "gym in New Cairo",
    "BX Fitness Hub",
    "personal trainer New Cairo",
    "fitness classes New Cairo",
    "pilates New Cairo",
    "boxing class New Cairo",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_EG",
    url: site.url,
    siteName: site.name,
    title: "BX Fitness Hub | Gym in New Cairo",
    description:
      "Where movement meets style. A gym in New Cairo open 6AM to 1AM, with 15 classes a week, personal training and recovery under one roof.",
    images: [
      {
        url: "/images/cardio-rings.jpg",
        width: 580,
        height: 1226,
        alt: "The cardio deck at BX Fitness Hub beneath circular pendant lighting",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BX Fitness Hub | Gym in New Cairo",
    description:
      "Where movement meets style. Open 6AM to 1AM, every day, in New Cairo.",
    images: ["/images/cardio-rings.jpg"],
  },
  robots: { index: true, follow: true },
};

/** Schema.org LocalBusiness, so the gym can surface for local searches. */
const structuredData = {
  "@context": "https://schema.org",
  "@type": "HealthAndBeautyBusiness",
  additionalType: "https://schema.org/ExerciseGym",
  name: site.name,
  description:
    "Gym, studios, personal training and recovery in New Cairo. Open 6AM to 1AM every day.",
  slogan: site.tagline,
  url: site.url,
  telephone: site.phone.href.replace("tel:", ""),
  image: `${site.url}/images/cardio-rings.jpg`,
  address: {
    "@type": "PostalAddress",
    streetAddress: `${site.address.line1}, ${site.address.line2}`,
    addressLocality: "New Cairo",
    addressRegion: "Cairo Governorate",
    postalCode: "4760001",
    addressCountry: site.address.country,
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: site.coords.lat,
    longitude: site.coords.lng,
  },
  hasMap: site.maps,
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: site.hours.opens,
      closes: site.hours.closes,
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: site.rating.value,
    reviewCount: site.rating.count,
  },
  sameAs: [site.social.instagram, site.social.spa],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-ink">
        <a
          href="#main"
          className="font-display sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-lime focus:px-4 focus:py-3 focus:text-[0.8rem] focus:tracking-[0.12em] focus:text-ink"
        >
          Skip to content
        </a>

        <HashScroll />
        <Navbar />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <MobileBar />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
