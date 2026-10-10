/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

// smartcube-web-bluetooth's published ESM build re-exports named bindings from the CJS package
// `aes-js` in a way that fails static ESM interop analysis ("Named export 'AES' not found")
// under Node, Vite, AND webpack alike — a real upstream packaging defect, not specific to this
// project (reproduced identically in all three). Resolving the bare specifier straight to its
// CJS build sidesteps it entirely; see the matching Vitest alias in vitest.config.ts and ticket
// 002's Open question R8. Both bundlers are aliased since `next dev` may run either.
const SMARTCUBE_CJS_PATH = new URL(
  "./node_modules/smartcube-web-bluetooth/dist/cjs/index.cjs",
  import.meta.url,
).pathname;

/** @type {import("next").NextConfig} */
const config = {
  webpack: (webpackConfig) => {
    webpackConfig.resolve.alias["smartcube-web-bluetooth"] = SMARTCUBE_CJS_PATH;
    return webpackConfig;
  },
  turbopack: {
    resolveAlias: {
      "smartcube-web-bluetooth": SMARTCUBE_CJS_PATH,
    },
  },
};

export default config;
