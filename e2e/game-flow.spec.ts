import { expect, test, type Page } from "@playwright/test";

const collectPageErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
};

test("splash screen shows the title and advances on key press", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("./");
  await expect(page.getByRole("heading", { name: /backrooms/i })).toBeVisible();
  await expect(page.getByText(/press any key/i)).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/menu\/?$/);
  expect(errors).toEqual([]);
});

test("menu configures settings and persists them", async ({ page }) => {
  await page.goto("menu/");
  await expect(page.getByText(/single player/i)).toBeVisible();
  await expect(page.getByText(/multiplayer soon/i)).toBeVisible();

  await page.getByRole("spinbutton", { name: "Level number" }).fill("6");
  await expect(page.getByText("Lights Out")).toBeVisible();
  await page.getByRole("combobox", { name: "Difficulty" }).selectOption("medium");

  await page.reload();
  await expect(page.getByRole("spinbutton", { name: "Level number" })).toHaveValue("6");
  await expect(page.getByRole("combobox", { name: "Difficulty" })).toHaveValue("medium");
});

test("full flow: menu -> game boots 3D world -> quit back to menu", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("menu/");
  await page.getByRole("spinbutton", { name: "Level number" }).fill("0");
  await page.getByTestId("start-game").click();

  await expect(page).toHaveURL(/\/play\/?$/);
  // Enter overlay names the level and the canvas boots behind it.
  await expect(page.getByTestId("enter-overlay")).toBeVisible();
  await expect(page.getByTestId("enter-overlay").getByText(/Level 0 — The Lobby/)).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("hud")).toBeVisible();
  // Touch controls are coarse-pointer only — never on a fine-pointer desktop.
  await expect(page.getByTestId("touch-controls")).not.toBeVisible();

  // WebGL must actually have initialized (SwiftShader in CI).
  const webglBooted = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    return canvas instanceof HTMLCanvasElement && canvas.width > 0;
  });
  expect(webglBooted).toBe(true);

  await page.getByRole("button", { name: /back to menu/i }).click();
  await expect(page).toHaveURL(/\/menu\/?$/);
  expect(errors).toEqual([]);
});

test("play -> menu -> play again does not leak or crash (context reboot)", async ({ page }) => {
  const errors = collectPageErrors(page);
  for (let run = 0; run < 2; run++) {
    await page.goto("menu/");
    await page.getByTestId("start-game").click();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /back to menu/i }).click();
    await expect(page).toHaveURL(/\/menu\/?$/);
  }
  expect(errors).toEqual([]);
});

test("deep link / refresh on play lands on the enter overlay, not a frozen world", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  // Direct load of /play (same as a mid-game refresh) must walk the phase
  // machine all the way to "loading" — stalling at "menu" renders the world
  // with no overlay and a simulation that never starts.
  await page.goto("play/");
  await expect(page.getByTestId("enter-overlay")).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(page.getByTestId("enter-overlay")).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("pointer lock enters the game and Esc pauses it", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "pointer lock is only reliable in chromium headless");
  await page.goto("menu/");
  await page.getByTestId("start-game").click();
  await expect(page.getByTestId("enter-game")).toBeVisible();
  await page.getByTestId("enter-game").click();

  // Pointer lock acquired: overlay disappears, simulation starts.
  await expect(page.getByTestId("enter-overlay")).not.toBeVisible({ timeout: 10_000 });

  // Synthesized Escape doesn't release pointer lock in headless Chromium;
  // exitPointerLock() fires the same unlock event the real Esc key does.
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.getByTestId("pause-menu")).toBeVisible();

  await page.getByTestId("quit-to-menu").click();
  await expect(page).toHaveURL(/\/menu\/?$/);
});
