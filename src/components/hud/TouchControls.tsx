"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { normalizeStick, stickToMoveFlags } from "@/hooks/joystickMath";
import { resetTouchInputBus, touchInputBus } from "@/hooks/touchInputBus";
import { useSettingsStore } from "@/state/settingsStore";
import styles from "./TouchControls.module.css";

const JOYSTICK_RADIUS = 46;
const JOYSTICK_DEADZONE = 8;

export interface TouchControlsProps {
  onPause(): void;
}

/**
 * On-screen mobile controls: a virtual joystick (move), a hold-to-sprint
 * button, drag-anywhere-else-to-look, and a pause button (Esc doesn't exist
 * on touch). Writes into touchInputBus, which PlayerRig drains every frame —
 * this component owns no simulation state itself, only gesture capture.
 */
export function TouchControls({ onPause }: TouchControlsProps) {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickThumbRef = useRef<HTMLDivElement>(null);
  const joystickPointerId = useRef<number | null>(null);
  const joystickOrigin = useRef({ x: 0, y: 0 });

  const lookPointerId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  const sensitivity = useSettingsStore((state) => state.touchLookSensitivity);
  const sensitivityRef = useRef(sensitivity);
  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => resetTouchInputBus, []);

  const resetJoystick = useCallback(() => {
    touchInputBus.move.forward = false;
    touchInputBus.move.backward = false;
    touchInputBus.move.left = false;
    touchInputBus.move.right = false;
    const thumb = joystickThumbRef.current;
    if (thumb) thumb.style.transform = "translate(0px, 0px)";
  }, []);

  const onJoystickPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const base = joystickBaseRef.current;
    if (!base || joystickPointerId.current !== null) return;
    joystickPointerId.current = event.pointerId;
    const rect = base.getBoundingClientRect();
    joystickOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    base.setPointerCapture?.(event.pointerId);
  };

  const onJoystickPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerId.current !== event.pointerId) return;
    const dx = event.clientX - joystickOrigin.current.x;
    const dy = event.clientY - joystickOrigin.current.y;
    const stick = normalizeStick(dx, dy, JOYSTICK_RADIUS, JOYSTICK_DEADZONE);
    const flags = stickToMoveFlags(stick.x, stick.y);
    touchInputBus.move.forward = flags.forward;
    touchInputBus.move.backward = flags.backward;
    touchInputBus.move.left = flags.left;
    touchInputBus.move.right = flags.right;
    const thumb = joystickThumbRef.current;
    if (thumb) {
      thumb.style.transform = `translate(${stick.x * JOYSTICK_RADIUS}px, ${stick.y * JOYSTICK_RADIUS}px)`;
    }
  };

  const onJoystickPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerId.current !== event.pointerId) return;
    joystickPointerId.current = null;
    resetJoystick();
  };

  const onSprintDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    touchInputBus.move.sprint = true;
  };
  const onSprintUp = () => {
    touchInputBus.move.sprint = false;
  };

  // A tap-to-pause button doesn't need press/hold tracking like sprint does,
  // so a plain click handler is used here — more robust than onPointerDown
  // across input backends (some touch-event synthesis paths, including
  // automated testing, don't reliably cascade a pointerdown into a click).
  const onPausePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const onLookPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== null) return;
    lookPointerId.current = event.pointerId;
    lookLast.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onLookPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== event.pointerId) return;
    const dx = event.clientX - lookLast.current.x;
    const dy = event.clientY - lookLast.current.y;
    lookLast.current = { x: event.clientX, y: event.clientY };
    touchInputBus.lookDX += dx * sensitivityRef.current;
    touchInputBus.lookDY += dy * sensitivityRef.current;
  };

  const onLookPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== event.pointerId) return;
    lookPointerId.current = null;
  };

  return (
    <div
      className={styles.lookSurface}
      data-testid="touch-controls"
      onPointerDown={onLookPointerDown}
      onPointerMove={onLookPointerMove}
      onPointerUp={onLookPointerUp}
      onPointerCancel={onLookPointerUp}
    >
      <div
        ref={joystickBaseRef}
        className={styles.joystickBase}
        data-testid="touch-joystick"
        onPointerDown={onJoystickPointerDown}
        onPointerMove={onJoystickPointerMove}
        onPointerUp={onJoystickPointerUp}
        onPointerCancel={onJoystickPointerUp}
      >
        <div ref={joystickThumbRef} className={styles.joystickThumb} />
      </div>

      <button
        type="button"
        className={styles.sprintButton}
        data-testid="touch-sprint"
        aria-label="Sprint"
        onPointerDown={onSprintDown}
        onPointerUp={onSprintUp}
        onPointerCancel={onSprintUp}
        onPointerLeave={onSprintUp}
      >
        Run
      </button>

      <button
        type="button"
        className={styles.pauseButton}
        data-testid="touch-pause"
        aria-label="Pause"
        onPointerDown={onPausePointerDown}
        onClick={onPause}
      >
        ❚❚
      </button>
    </div>
  );
}
