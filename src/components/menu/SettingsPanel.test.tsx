import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_LEVEL } from "@/config/constants";
import { useSettingsStore } from "@/state/settingsStore";
import { SettingsPanel } from "./SettingsPanel";

describe("SettingsPanel", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      level: 0,
      difficulty: "peaceful",
      musicEnabled: true,
      musicVolume: 0.7,
      sfxEnabled: true,
      sfxVolume: 0.8,
      mode: "single",
    });
  });

  it("steps the level with the +/- buttons and clamps at the bottom", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    await user.click(screen.getByRole("button", { name: "Next level" }));
    expect(useSettingsStore.getState().level).toBe(1);
    await user.click(screen.getByRole("button", { name: "Previous level" }));
    await user.click(screen.getByRole("button", { name: "Previous level" }));
    expect(useSettingsStore.getState().level).toBe(0);
  });

  it("clamps typed level numbers to 0..999", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    const input = screen.getByRole("spinbutton", { name: "Level number" });
    await user.clear(input);
    await user.type(input, "5000");
    expect(useSettingsStore.getState().level).toBeLessThanOrEqual(MAX_LEVEL);
  });

  it("shows the level preview name", () => {
    render(<SettingsPanel />);
    expect(screen.getByText("The Lobby")).toBeInTheDocument();
  });

  it("changes difficulty", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Difficulty" }), "hard");
    expect(useSettingsStore.getState().difficulty).toBe("hard");
  });

  it("marks multiplayer as coming soon", () => {
    render(<SettingsPanel />);
    expect(screen.getByText(/multiplayer soon/i)).toBeInTheDocument();
    expect(screen.getByText(/single player/i)).toBeInTheDocument();
  });

  it("toggles music and disables its slider when off", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    await user.click(screen.getByRole("switch", { name: "Music" }));
    expect(useSettingsStore.getState().musicEnabled).toBe(false);
    expect(screen.getByRole("slider", { name: "Music volume" })).toBeDisabled();
  });

  it("hides level and mode controls in compact mode (pause menu)", () => {
    render(<SettingsPanel compact />);
    expect(screen.queryByRole("spinbutton", { name: "Level number" })).not.toBeInTheDocument();
    expect(screen.queryByText(/multiplayer soon/i)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Difficulty" })).toBeInTheDocument();
  });
});
