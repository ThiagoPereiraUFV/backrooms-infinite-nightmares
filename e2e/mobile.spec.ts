import { expect, test } from "@playwright/test";

test("starting the game in portrait on a touch device shows the rotate advisory, landscape dismisses it", async ({
  page,
}) => {
  await page.goto("menu/");
  await page.getByRole("combobox", { name: "Level" }).selectOption("0");
  await page.getByTestId("start-game").click();

  await expect(page.getByTestId("enter-overlay")).toBeVisible();
  // Portrait is fine up to this point — only gameplay requires landscape.
  await expect(page.getByTestId("rotate-overlay")).not.toBeVisible();

  await page.getByTestId("enter-game").click();
  await expect(page.getByTestId("rotate-overlay")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/rotate your device to play/i)).toBeVisible();

  // Auto-fullscreen may have engaged; a real device doesn't need un-fullscreening
  // to rotate, but the emulated OS window does before it'll accept a resize.
  await page.evaluate(() => document.exitFullscreen?.().catch(() => {}));
  // exitFullscreen() resolves before the browser finishes tearing down the
  // fullscreen window state, so resizing immediately after can throw "restore
  // to normal state first" — wait for the flag to actually clear, then retry
  // the resize itself in case the race is still won by the browser.
  await page
    .waitForFunction(() => !document.fullscreenElement, null, { timeout: 5_000 })
    .catch(() => {});
  // Rotate to landscape: the viewport itself flips, same as a real device.
  const size = page.viewportSize();
  if (size) {
    await expect(async () => {
      await page.setViewportSize({ width: size.height, height: size.width });
    }).toPass({ timeout: 10_000 });
  }
  await expect(page.getByTestId("rotate-overlay")).not.toBeVisible({ timeout: 10_000 });
});

test("menu and settings remain usable in portrait", async ({ page }) => {
  await page.goto("menu/");
  await expect(page.getByRole("heading", { name: /backrooms/i })).toBeVisible();
  await expect(page.getByTestId("start-game")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Difficulty" })).toBeVisible();
});

test("touch controls appear during play and the pause button opens the pause menu", async ({
  page,
}) => {
  // Landscape from the start — gameplay requires it, this test targets play itself.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("menu/");
  await page.getByRole("combobox", { name: "Level" }).selectOption("0");
  await page.getByTestId("start-game").click();
  await page.getByTestId("enter-game").tap();

  await expect(page.getByTestId("touch-controls")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("touch-joystick")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sprint" })).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByTestId("pause-menu")).toBeVisible();
  await expect(page.getByTestId("touch-controls")).not.toBeVisible();
});
