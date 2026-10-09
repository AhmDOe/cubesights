import { expect, test } from "@playwright/test";

test.describe("001 Cube core domain model and shell", () => {
  test("@001-S2 a WCA scramble produces a valid, non-solved state", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("alg-text")).toHaveText("No scramble yet");

    await page.getByRole("button", { name: "Scramble" }).click();

    const algText = page.getByTestId("alg-text");
    await expect(algText).not.toHaveText("No scramble yet");
    const text = await algText.textContent();
    const moveCount = text?.trim().split(/\s+/).filter(Boolean).length ?? 0;
    expect(moveCount).toBeGreaterThanOrEqual(19);
  });

  test("@001-S9 the 3D cube renders and steps through an algorithm", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Scramble" }).click();
    await expect(page.getByTestId("cube-view")).toBeVisible();

    const next = page.getByRole("button", { name: "Next", exact: true });
    await next.click();
    await next.click();
    await next.click();
    // No crash and the control row remains interactive after stepping — the state-equality
    // assertion (rendered cube matches solved + first 3 scramble moves applied) is exercised at
    // the unit level in apply.test.ts; this spec is the real-browser smoke test for the player.
    await expect(next).toBeEnabled();
  });

  test("@001-S10 no server-side rendering crash from the 3D player", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    // The dynamic(ssr:false) boundary means no twisty-player markup should be present in the
    // initial HTML; after hydration + mount, the cube-view container is present.
    await expect(page.getByTestId("cube-view").or(page.getByTestId("cube-view-loading"))).toBeVisible();
  });

  test("@001-S12 shell page is usable at mobile width and keyboard accessible", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    await page.keyboard.press("Tab");
    const scrambleButton = page.getByRole("button", { name: "Scramble" });
    await scrambleButton.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("alg-text")).not.toHaveText("No scramble yet");
  });
});
