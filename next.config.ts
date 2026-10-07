import type { NextConfig } from "next";

// tools.valuefy.ro: tools for valuers (cadastral locator first). Private application: never indexed.
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
