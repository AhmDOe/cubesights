import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~": new URL("./src", import.meta.url).pathname,
      // smartcube-web-bluetooth's published ESM build re-exports named bindings from the CJS
      // package `aes-js` in a way that fails static ESM interop analysis ("Named export 'AES'
      // not found") under Node, Vite, AND webpack alike — a real upstream packaging defect, not
      // specific to this project. Resolving the bare specifier straight to its CJS build instead
      // sidesteps it entirely; see the matching Next.js webpack/turbopack alias in next.config.js
      // and ticket 002's Open question R8.
      "smartcube-web-bluetooth": new URL(
        "./node_modules/smartcube-web-bluetooth/dist/cjs/index.cjs",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/cube/**"],
      thresholds: {
        "src/cube/core/**": { lines: 90 },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/cube/**/*.test.ts", "tests/integration/**/*.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/components/**/*.test.tsx", "src/app/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
