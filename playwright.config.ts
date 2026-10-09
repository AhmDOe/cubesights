import { defineConfig, devices } from "@playwright/test";

/**
 * 001-R10: a Chromium project carrying the fake-camera/fake-bluetooth flags that tickets 002/003
 * need for hardware-free E2E tests. No other browser projects are configured for the POC — the
 * brief's input paths (Web Bluetooth, camera scanning) are Chromium-first by nature.
 *
 * PLAYWRIGHT_BASE_URL overrides the target (set by docker-compose's `test` service to
 * "http://app:3000" — the already-running `app` container over the Compose network). When unset
 * (the local/non-Docker case), Playwright starts and targets its own `npm run dev` on localhost.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const usingExternalServer = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            "--enable-experimental-web-platform-features",
            // Chrome's HTTPS-Upgrades feature silently rewrites http:// navigations to a
            // non-localhost, non-IP hostname (e.g. the Docker Compose service name "app") into
            // https://, which then fails as ERR_SSL_PROTOCOL_ERROR against our plain-HTTP dev
            // server. Disabled so navigation actually uses the scheme we asked for.
            "--disable-features=HttpsUpgrades,HttpsFirstModeV2ForEngagedSites",
          ],
        },
      },
    },
  ],
  webServer: usingExternalServer
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
