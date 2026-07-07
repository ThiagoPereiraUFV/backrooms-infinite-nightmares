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

  it("shows no hotbar with an empty inventory", () => {
    render(<Hud levelNumber={0} levelName="The Lobby" />);
    expect(screen.queryByTestId("hotbar")).not.toBeInTheDocument();
  });

  it("shows quantity for a stackable item held multiple times", () => {
    render(<Hud levelNumber={0} levelName="The Lobby" />);
    act(() => {
      usePlayerStore.getState().collectItem("bandage");
      usePlayerStore.getState().collectItem("bandage");
      usePlayerStore.getState().collectItem("bandage");
    });
    const hotbar = screen.getByTestId("hotbar");
    expect(hotbar).toHaveTextContent("1"); // slot key
    expect(hotbar).toHaveTextContent("B"); // bandage glyph
    expect(hotbar).toHaveTextContent("3"); // quantity
  });

  it("shows no quantity for a non-stackable item", () => {
    render(<Hud levelNumber={0} levelName="The Lobby" />);
    act(() => usePlayerStore.getState().collectItem("flashlight"));
    const hotbar = screen.getByTestId("hotbar");
    expect(hotbar).toHaveTextContent("F"); // flashlight glyph
    const hasQuantitySpan = [...hotbar.querySelectorAll("span")].some((el) =>
      el.className.includes("hotbarQuantity"),
    );
    expect(hasQuantitySpan).toBe(false);
  });

  it("highlights the flashlight slot only while it is on", () => {
    render(<Hud levelNumber={0} levelName="The Lobby" />);
    act(() => usePlayerStore.getState().collectItem("flashlight"));
    const slot = screen.getByTitle(/beam/i);
    expect(slot.className).not.toMatch(/Active/);
    act(() => usePlayerStore.getState().toggleFlashlight());
    expect(slot.className).toMatch(/Active/);
  });
});
