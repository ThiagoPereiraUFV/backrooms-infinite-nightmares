---
name: verify
description: Launch and drive Backrooms Infinite Nightmares in the integrated browser to observe changes at runtime.
---

# Verifying this game at runtime

## Launch

```sh
yarn dev   # background; poll http://localhost:3000 until 200 (~10s)
```

Deep links work in dev: `/menu/`, `/play/` (see gamePhase deep linking).

## Gotcha: pointer lock

The integrated browser (and any synthetic click) cannot grant the Pointer
Lock API — clicking ENTER on desktop logs
`THREE.PointerLockControls: Unable to use Pointer Lock API` and the game
never reaches "playing". **Use mobile emulation instead**: touch mode never
locks the pointer and shows on-screen controls (joystick, RUN, Pause).

1. `browser_emulate { width: 1024, height: 640, mobile: true }`
2. Navigate to `/play/`, click the "Enter" button → playing phase, HUD visible.
3. Pause via the `aria-label="Pause"` button; the pause menu hosts the
   compact SettingsPanel — sliders can be changed mid-run and take effect
   live on Resume.

Reset emulation (`{ reset: true }`) when done.

## Driving UI

- React sliders need the native value setter + `input` event:
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'0.5')`
  then `el.dispatchEvent(new Event('input',{bubbles:true}))`.
- Settings persist in `localStorage["bin-settings"]` (zustand persist,
  sanitized on rehydrate) — useful for pre-seeding state before navigation.
- The world seed is random per run (`gameStore.randomSeed`), so A/B visual
  comparisons must toggle settings live via the pause menu at a fixed
  viewpoint, not across reloads.
