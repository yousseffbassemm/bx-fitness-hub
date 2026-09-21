import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff",
  // Never let this area into a search index.
  robots: { index: false, follow: false, nocache: true },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-ink">{children}</div>;
}
