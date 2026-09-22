import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "*.local",
  ],
};

export default nextConfig;
