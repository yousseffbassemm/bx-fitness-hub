import NotFound from "@/components/NotFound";

/**
 * Caught here so it keeps the navbar and footer the rest of the site has.
 *
 * No metadata export: a not-found file does not get one. The title is
 * whichever the page that threw had already resolved - "Your booking", for
 * /b/<token> - and that page also carries the noindex, which is what
 * actually matters for a 404.
 */
// Same reason as the booking page: nothing here should point a canonical
// at the home page while carrying a noindex.
export const metadata = { alternates: { canonical: null } };

export default function SiteNotFound() {
  return <NotFound />;
}
