import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTouchInputBus, touchInputBus } from "@/hooks/touchInputBus";
import { useSettingsStore } from "@/state/settingsStore";
import { TouchControls } from "./TouchControls";

beforeEach(() => {
  resetTouchInputBus();
  useSettingsStore.setState({ touchLookSensitivity: 1 });
});

const pointerDown = (el: Element, props: Partial<PointerEventInit> = {}) =>
  fireEvent.pointerDown(el, { pointerId: 1, clientX: 0, clientY: 0, ...props });
const pointerMove = (el: Element, props: Partial<PointerEventInit> = {}) =>
  fireEvent.pointerMove(el, { pointerId: 1, clientX: 0, clientY: 0, ...props });
const pointerUp = (el: Element, props: Partial<PointerEventInit> = {}) =>
  fireEvent.pointerUp(el, { pointerId: 1, clientX: 0, clientY: 0, ...props });

describe("TouchControls", () => {
  it("renders the joystick, sprint button, and pause button", () => {
    render(<TouchControls onPause={() => {}} />);
    expect(screen.getByTestId("touch-controls")).toBeInTheDocument();
    expect(screen.getByTestId("touch-joystick")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sprint" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("sets sprint true on press and false on release", () => {
    render(<TouchControls onPause={() => {}} />);
    const sprint = screen.getByRole("button", { name: "Sprint" });
    pointerDown(sprint);
    expect(touchInputBus.move.sprint).toBe(true);
    pointerUp(sprint);
    expect(touchInputBus.move.sprint).toBe(false);
  });

  it("calls onPause when the pause button is clicked/tapped", () => {
    const onPause = vi.fn();
    render(<TouchControls onPause={onPause} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("drives forward/left move flags from a joystick drag, and clears them on release", () => {
    render(<TouchControls onPause={() => {}} />);
    const joystick = screen.getByTestId("touch-joystick");
    pointerDown(joystick, { clientX: 0, clientY: 0 });
    // Drag up-left: forward + left (screen y-down-positive, so negative dy is "up").
    pointerMove(joystick, { clientX: -40, clientY: -40 });
    expect(touchInputBus.move.forward).toBe(true);
    expect(touchInputBus.move.left).toBe(true);
    expect(touchInputBus.move.backward).toBe(false);
    expect(touchInputBus.move.right).toBe(false);

    pointerUp(joystick, { clientX: -40, clientY: -40 });
    expect(touchInputBus.move.forward).toBe(false);
    expect(touchInputBus.move.left).toBe(false);
  });

  it("ignores a second pointer while the joystick is already claimed", () => {
    render(<TouchControls onPause={() => {}} />);
    const joystick = screen.getByTestId("touch-joystick");
    pointerDown(joystick, { pointerId: 1, clientX: 0, clientY: 0 });
    pointerMove(joystick, { pointerId: 1, clientX: -40, clientY: 0 });
    expect(touchInputBus.move.left).toBe(true);

    // A different pointer moving should not reset or hijack the stick.
    pointerMove(joystick, { pointerId: 2, clientX: 40, clientY: 0 });
    expect(touchInputBus.move.left).toBe(true);
    expect(touchInputBus.move.right).toBe(false);
  });

  it("accumulates look deltas from a drag outside the joystick/buttons", () => {
    render(<TouchControls onPause={() => {}} />);
    const surface = screen.getByTestId("touch-controls");
    pointerDown(surface, { clientX: 100, clientY: 100 });
    pointerMove(surface, { clientX: 130, clientY: 90 });
    expect(touchInputBus.lookDX).toBeGreaterThan(0);
    expect(touchInputBus.lookDY).toBeLessThan(0);
  });

  it("scales look deltas by the touch sensitivity setting", () => {
    useSettingsStore.setState({ touchLookSensitivity: 2 });
    render(<TouchControls onPause={() => {}} />);
    const surface = screen.getByTestId("touch-controls");
    pointerDown(surface, { clientX: 0, clientY: 0 });
    pointerMove(surface, { clientX: 10, clientY: 0 });
    expect(touchInputBus.lookDX).toBeCloseTo(20);
  });

  it("does not treat a joystick or sprint press as a look-drag", () => {
    render(<TouchControls onPause={() => {}} />);
    pointerDown(screen.getByTestId("touch-joystick"), { clientX: 5, clientY: 5 });
    pointerMove(screen.getByTestId("touch-joystick"), { clientX: 5, clientY: 5 });
    expect(touchInputBus.lookDX).toBe(0);
    expect(touchInputBus.lookDY).toBe(0);
  });

  it("resets the input bus on unmount", () => {
    const { unmount } = render(<TouchControls onPause={() => {}} />);
    pointerDown(screen.getByRole("button", { name: "Sprint" }));
    expect(touchInputBus.move.sprint).toBe(true);
    unmount();
    expect(touchInputBus.move.sprint).toBe(false);
  });
});
