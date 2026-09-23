import Footer from "@/components/Footer";
import MobileBar from "@/components/MobileBar";
import Navbar from "@/components/Navbar";
import NotFound from "@/components/NotFound";

export const metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

/**
 * An address that matches no route at all.
 *
 * This one sits outside the (site) group, so it does not inherit the
 * navbar and footer - which is why a mistyped address used to land on a
 * blank black page with a stock "404" and nothing at all to click. The
 * chrome is put back by hand here; the structured data and the marketing
 * metadata are deliberately left off a page that should not be indexed.
 */
export default function RootNotFound() {
  return (
    <>
      <Navbar />
      <main id="main" className="flex-1">
        <NotFound />
      </main>
      <Footer />
      <MobileBar />
    </>
  );
}
