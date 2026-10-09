import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~": new URL("./src", import.meta.url).pathname,
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
