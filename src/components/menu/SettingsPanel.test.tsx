import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LEVELS } from "@/engine/generation/levelProfile";
import { mockMatchMedia } from "@/hooks/matchMediaTestUtils";
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
      touchLookSensitivity: 1,
      fogIntensity: 0.5,
    });
  });

  it("renders exactly one option per roster level, labeled with number and name", () => {
    render(<SettingsPanel />);
    const select = screen.getByRole("combobox", { name: "Level" });
    const options = Array.from(select.querySelectorAll("option"));
    expect(options).toHaveLength(LEVELS.length);
    for (const profile of LEVELS) {
      expect(
        options.some((option) => option.textContent === `${profile.level} — ${profile.name}`),
      ).toBe(true);
    }
  });

  it("choosing a level updates the store and the preview line", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Level" }), "6");
    expect(useSettingsStore.getState().level).toBe(6);
    expect(screen.getByText("Lights Out")).toBeInTheDocument();
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

  it("updates fog intensity from the slider", () => {
    render(<SettingsPanel />);
    const slider = screen.getByRole("slider", { name: "Fog intensity" });
    fireEvent.change(slider, { target: { value: "0" } });
    expect(useSettingsStore.getState().fogIntensity).toBe(0);
    fireEvent.change(slider, { target: { value: "1" } });
    expect(useSettingsStore.getState().fogIntensity).toBe(1);
  });

  it("hides level and mode controls in compact mode (pause menu)", () => {
    render(<SettingsPanel compact />);
    expect(screen.queryByRole("combobox", { name: "Level" })).not.toBeInTheDocument();
    expect(screen.queryByText(/multiplayer soon/i)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Difficulty" })).toBeInTheDocument();
  });

  it("hides the touch look-sensitivity slider on a fine-pointer device", () => {
    render(<SettingsPanel />);
    expect(
      screen.queryByRole("slider", { name: "Touch look sensitivity" }),
    ).not.toBeInTheDocument();
  });

  describe("on a coarse-pointer (touch) device", () => {
    afterEach(() => {
      // @ts-expect-error test cleanup of a test-only global override
      delete window.matchMedia;
    });

    it("shows and updates the touch look-sensitivity slider", () => {
      mockMatchMedia({ "(pointer: coarse), (hover: none)": true });
      render(<SettingsPanel />);
      const slider = screen.getByRole("slider", { name: "Touch look sensitivity" });
      expect(slider).toBeInTheDocument();
      fireEvent.change(slider, { target: { value: "2" } });
      expect(useSettingsStore.getState().touchLookSensitivity).toBe(2);
    });
  });
});
