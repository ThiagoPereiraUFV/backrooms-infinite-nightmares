import { defineConfig, devices } from "@playwright/test";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const port = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    // Trailing slash matters: tests use relative paths ("menu/") so the
    // GitHub Pages base path is preserved when set.
    baseURL: `http://127.0.0.1:${port}${basePath}/`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /mobile\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Software WebGL so the 3D scene boots on headless CI runners.
          args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
        },
      },
    },
    {
      // Portrait touch emulation (still Chromium, for SwiftShader WebGL
      // compatibility) — covers the M12/M13 mobile UX: rotate advisory,
      // touch controls. Kept in its own spec file / project so it never
      // runs against the desktop flows.
      name: "mobile-chromium",
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        launchOptions: {
          args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
        },
      },
    },
  ],
  webServer: {
    command: "node scripts/serve-out.mjs",
    url: `http://127.0.0.1:${port}${basePath}/`,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(port),
      NEXT_PUBLIC_BASE_PATH: basePath,
    },
  },
});
