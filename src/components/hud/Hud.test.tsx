import { render, screen } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "@/state/playerStore";
import { Hud } from "./Hud";

describe("Hud", () => {
  beforeEach(() => {
    act(() => usePlayerStore.getState().reset());
  });

  it("shows the level badge", () => {
    render(<Hud levelNumber={42} levelName="The Hollow Halls" />);
    expect(screen.getByText(/The Hollow Halls/)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("reflects health and stamina snapshots from the store", () => {
    render(<Hud levelNumber={0} levelName="The Lobby" />);
    act(() => usePlayerStore.getState().publish({ health: 50, stamina: 25 }));
    expect(screen.getByRole("progressbar", { name: "Health" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    expect(screen.getByRole("progressbar", { name: "Stamina" })).toHaveAttribute(
      "aria-valuenow",
      "25",
    );
  });

  it("marks the stamina bar when exhausted", () => {
    render(<Hud levelNumber={0} levelName="The Lobby" />);
    act(() => usePlayerStore.getState().publish({ stamina: 5, exhausted: true }));
    expect(screen.getByRole("progressbar", { name: /Stamina \(exhausted\)/ })).toBeInTheDocument();
  });
});
