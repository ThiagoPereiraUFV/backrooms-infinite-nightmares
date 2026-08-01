import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ServiceWorkerRegistration", () => {
  it("does not register outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const register = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: { register } });

    render(<ServiceWorkerRegistration />);

    expect(register).not.toHaveBeenCalled();
  });

  it("registers the worker at the base-path-aware URL in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: { register } });

    render(<ServiceWorkerRegistration />);

    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("does not throw when registration rejects", () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockRejectedValue(new Error("unsupported"));
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: { register } });

    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });

  it("does nothing when the browser has no serviceWorker support", () => {
    vi.stubEnv("NODE_ENV", "production");
    const nav = { ...navigator };
    // @ts-expect-error simulating a browser without the API
    delete nav.serviceWorker;
    vi.stubGlobal("navigator", nav);

    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });
});
