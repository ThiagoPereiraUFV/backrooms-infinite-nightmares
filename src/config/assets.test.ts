import { afterEach, describe, expect, it, vi } from "vitest";

const ENV_KEY = "NEXT_PUBLIC_BASE_PATH";
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
  vi.resetModules();
});

describe("assetUrl", () => {
  it("returns the bare path when no base path is configured", async () => {
    delete process.env[ENV_KEY];
    vi.resetModules();
    const { assetUrl } = await import("./assets");
    expect(assetUrl("/audio/ambience/lobbyHum.ogg")).toBe("/audio/ambience/lobbyHum.ogg");
  });

  it("prefixes the path with the base path when configured (GitHub Pages case)", async () => {
    process.env[ENV_KEY] = "/backrooms-infinite-nightmares";
    vi.resetModules();
    const { assetUrl } = await import("./assets");
    expect(assetUrl("/audio/ambience/lobbyHum.ogg")).toBe(
      "/backrooms-infinite-nightmares/audio/ambience/lobbyHum.ogg",
    );
  });
});
