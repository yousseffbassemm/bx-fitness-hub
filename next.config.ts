import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The dev-only route indicator sits bottom-left by default, which on a phone
   * is directly on top of the CALL button in the fixed bar - the one thing on
   * the page someone is most likely to be reaching for. It is only ever
   * visible in development, but development is what is being looked at on the
   * phone, so it goes.
   */
  devIndicators: false,

  /**
   * Origins allowed to request dev-only assets and endpoints.
   *
   * Next blocks cross-origin dev requests by default, and "cross-origin" here
   * includes a phone on the same Wi-Fi opening the site by the Mac's address
   * rather than localhost. Without these the page loads but the dev client -
   * hot reloading among it - is refused, so edits never reach the phone.
   *
   * Only the hostname is matched, so no scheme and no port. `*` stands for one
   * label, which for an address is one octet: the private ranges below cover
   * whatever a router hands out, and `*.local` covers the Bonjour name, which
   * survives the address changing. This has no effect on a production build.
   */
  allowedDevOrigins: [
    // Same network: whatever the router or a phone's hotspot hands out.
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    // The Bonjour name, which survives the address changing.
    "*.local",
    // The public tunnel. Without this the page still renders, but every
    // dev-only request is refused, React never finishes hydrating, and the
    // result is a site that looks loaded and does nothing: no scroll reveals,
    // no carousel, no booking form.
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
