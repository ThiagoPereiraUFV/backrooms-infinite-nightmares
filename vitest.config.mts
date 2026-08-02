import { coverageConfigDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/engine/**", "src/state/**", "src/config/**"],
      // Test-only fakes, not engine logic — excluded so a helper's own
      // (deliberately untested) branches don't distort the gate.
      exclude: [...coverageConfigDefaults.exclude, "src/engine/audio/audioTestUtils.ts"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
