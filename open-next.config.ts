import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});

// Paths sent to the worker first (wrangler.jsonc run_worker_first) are the private module data under /_localizare/*.
// The default resolver would serve them from ASSETS; this one never does, so they 404 and are only read by
// /api/localizare/* after the account and subscription checks.
config.middleware = {
  ...config.middleware!,
  assetResolver: () => ({ name: "no-direct-assets", maybeGetAssetResult: async () => undefined }),
};

export default config;
