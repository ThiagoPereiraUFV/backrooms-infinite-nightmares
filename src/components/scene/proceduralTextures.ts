import * as THREE from "three";
import type { LevelPalette, SurfaceStyle } from "@/engine/generation/levelProfile";
import { createRng, hashString } from "@/engine/generation/rng";

/**
 * Retro/dated finishes, generated on a canvas once per level: nine painter
 * strategies (`SURFACE_PAINTERS`), one per `SurfaceStyle`, each composing
 * shared primitives (stains, speckle, grids, blotches). No image assets;
 * every level gets its own look for free. Cannot be unit-tested in jsdom
 * (no native `<canvas>` context) — see PLAN-4 §12.7; verified visually.
 */

const SIZE = 256;

const makeCanvas = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return [canvas, ctx];
};

const asTexture = (canvas: HTMLCanvasElement, repeat: number): THREE.CanvasTexture => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const shade = (hex: string, factor: number): string => {
  const color = new THREE.Color(hex);
  color.multiplyScalar(factor);
  return `#${color.getHexString()}`;
};

const addStains = (
  ctx: CanvasRenderingContext2D,
  seedKey: string,
  decay: number,
  color: string,
): void => {
  const rng = createRng(hashString(seedKey));
  const stainCount = Math.round(decay * 7);
  ctx.fillStyle = color;
  for (let i = 0; i < stainCount; i++) {
    ctx.globalAlpha = 0.05 + rng.next() * 0.12;
    ctx.beginPath();
    ctx.ellipse(
      rng.next() * SIZE,
      rng.next() * SIZE,
      8 + rng.next() * 42,
      6 + rng.next() * 30,
      rng.next() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const addSpeckle = (
  ctx: CanvasRenderingContext2D,
  seedKey: string,
  strength: number,
  count = 1800,
): void => {
  const rng = createRng(hashString(seedKey));
  for (let i = 0; i < count; i++) {
    const bright = rng.chance(0.5);
    ctx.fillStyle = bright ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.05)";
    ctx.globalAlpha = strength;
    ctx.fillRect(rng.next() * SIZE, rng.next() * SIZE, 1 + rng.next() * 2, 1 + rng.next() * 2);
  }
  ctx.globalAlpha = 1;
};

/** Regularly spaced grid lines — tile grout, panel seams, block coursing. */
const addGrid = (
  ctx: CanvasRenderingContext2D,
  spacing: number,
  color: string,
  lineWidth: number,
): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  for (let t = 0; t <= SIZE; t += spacing) {
    ctx.beginPath();
    ctx.moveTo(t, 0);
    ctx.lineTo(t, SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, t);
    ctx.lineTo(SIZE, t);
    ctx.stroke();
  }
};

/** Staggered horizontal courses — cinder-block joints. */
const addBlockCourses = (
  ctx: CanvasRenderingContext2D,
  courseHeight: number,
  blockWidth: number,
  color: string,
): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  let row = 0;
  for (let y = 0; y <= SIZE; y += courseHeight) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SIZE, y);
    ctx.stroke();
    const offset = row % 2 === 0 ? 0 : blockWidth / 2;
    for (let x = -blockWidth + offset; x <= SIZE; x += blockWidth) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, Math.min(SIZE, y + courseHeight));
      ctx.stroke();
    }
    row++;
  }
};

/** Large soft-edged organic patches — mottled rock, figured-carpet pattern. */
const addBlotches = (
  ctx: CanvasRenderingContext2D,
  seedKey: string,
  count: number,
  color: string,
  alphaRange: [number, number],
  sizeRange: [number, number],
): void => {
  const rng = createRng(hashString(seedKey));
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alphaRange[0] + rng.next() * (alphaRange[1] - alphaRange[0]);
    const r = sizeRange[0] + rng.next() * (sizeRange[1] - sizeRange[0]);
    ctx.beginPath();
    ctx.ellipse(
      rng.next() * SIZE,
      rng.next() * SIZE,
      r,
      r * (0.6 + rng.next() * 0.6),
      rng.next() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

/** Diagonal cross-hatch — diamond-plate steel flooring. */
const addDiamondPlate = (ctx: CanvasRenderingContext2D, color: string): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (let d = -SIZE; d <= SIZE; d += 14) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + SIZE, SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(d, SIZE);
    ctx.lineTo(d + SIZE, 0);
    ctx.stroke();
  }
};

/** Uniform mottled fill — the shared "worn surface" base most floors use. */
const mottledFill = (
  ctx: CanvasRenderingContext2D,
  base: string,
  seedKey: string,
  spread: number,
): void => {
  const rng = createRng(hashString(seedKey));
  for (let y = 0; y < SIZE; y += 4) {
    for (let x = 0; x < SIZE; x += 4) {
      ctx.fillStyle = shade(base, 1 - spread / 2 + rng.next() * spread);
      ctx.fillRect(x, y, 4, 4);
    }
  }
};

export interface SurfacePainter {
  wall(palette: LevelPalette, decay: number): THREE.CanvasTexture;
  floor(palette: LevelPalette, decay: number): THREE.CanvasTexture;
  ceiling(palette: LevelPalette, decay: number): THREE.CanvasTexture;
}

// ---------------------------------------------------------------------------
// L0 — dampWallpaper: the only style that keeps the original vertical
// striping; every other level stops looking like an office because it stops
// using this painter.
// ---------------------------------------------------------------------------
const dampWallpaper: SurfacePainter = {
  wall(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.wall;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = shade(palette.wall, 0.92);
    for (let x = 0; x < SIZE; x += 16) ctx.fillRect(x, 0, 6, SIZE);
    ctx.fillStyle = shade(palette.wall, 1.06);
    for (let x = 8; x < SIZE; x += 32) ctx.fillRect(x, 0, 2, SIZE);
    addSpeckle(ctx, `wall-speckle-${palette.wall}`, 0.7);
    addStains(ctx, `wall-stains-${palette.wall}-${decay}`, decay, shade(palette.wall, 0.45));
    ctx.fillStyle = shade(palette.accent, 0.8);
    ctx.fillRect(0, SIZE - 14, SIZE, 14);
    return asTexture(canvas, 1);
  },
  floor(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.floor;
    ctx.fillRect(0, 0, SIZE, SIZE);
    mottledFill(ctx, palette.floor, `floor-${palette.floor}`, 0.2);
    addStains(
      ctx,
      `floor-stains-${palette.floor}-${decay}`,
      decay * 1.4,
      shade(palette.floor, 0.4),
    );
    return asTexture(canvas, 1);
  },
  ceiling(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.ceiling;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addSpeckle(ctx, `ceiling-speckle-${palette.ceiling}`, 0.5);
    addGrid(ctx, SIZE / 2, shade(palette.ceiling, 0.75), 3);
    addStains(
      ctx,
      `ceiling-stains-${palette.ceiling}-${decay}`,
      decay * 0.8,
      shade(palette.ceiling, 0.5),
    );
    return asTexture(canvas, 1);
  },
};

// ---------------------------------------------------------------------------
// L1 — rawConcrete: poured slab, form-tie marks, no ceiling tiles.
// ---------------------------------------------------------------------------
const rawConcrete: SurfacePainter = {
  wall(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.wall;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addSpeckle(ctx, `concrete-wall-${palette.wall}`, 0.9, 2400);
    // Form-tie marks: a sparse regular grid of small dark dots.
    ctx.fillStyle = shade(palette.wall, 0.6);
    for (let y = 20; y < SIZE; y += 42) {
      for (let x = 20; x < SIZE; x += 42) {
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    addStains(
      ctx,
      `concrete-wall-stains-${palette.wall}-${decay}`,
      decay,
      shade(palette.wall, 0.4),
    );
    return asTexture(canvas, 1);
  },
  floor(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.floor;
    ctx.fillRect(0, 0, SIZE, SIZE);
    mottledFill(ctx, palette.floor, `concrete-floor-${palette.floor}`, 0.1);
    addSpeckle(ctx, `concrete-floor-speckle-${palette.floor}`, 0.5);
    addStains(
      ctx,
      `concrete-floor-stains-${palette.floor}-${decay}`,
      decay,
      shade(palette.floor, 0.4),
    );
    return asTexture(canvas, 1);
  },
  ceiling(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.ceiling;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addSpeckle(ctx, `concrete-ceiling-${palette.ceiling}`, 0.6, 2000);
    addStains(
      ctx,
      `concrete-ceiling-stains-${palette.ceiling}-${decay}`,
      decay,
      shade(palette.ceiling, 0.45),
    );
    return asTexture(canvas, 1);
  },
};

// ---------------------------------------------------------------------------
// L2 — rivetedSteel: painted steel plate, plate floor, pipe-crowded ceiling.
// ---------------------------------------------------------------------------
const rivetedSteel: SurfacePainter = {
  wall(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.wall;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addGrid(ctx, SIZE / 4, shade(palette.wall, 0.7), 2);
    ctx.fillStyle = shade(palette.wall, 0.55);
    for (let y = 0; y <= SIZE; y += SIZE / 4) {
      for (let x = 0; x <= SIZE; x += SIZE / 4) {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    addSpeckle(ctx, `steel-wall-${palette.wall}`, 0.4);
    addStains(
      ctx,
      `steel-wall-rust-${palette.wall}-${decay}`,
      decay * 1.3,
      shade(palette.accent, 0.6),
    );
    return asTexture(canvas, 1);
  },
  floor(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.floor;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addDiamondPlate(ctx, shade(palette.floor, 0.7));
    addStains(
      ctx,
      `steel-floor-rust-${palette.floor}-${decay}`,
      decay * 1.2,
      shade(palette.accent, 0.55),
    );
    return asTexture(canvas, 1);
  },
  ceiling(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = shade(palette.ceiling, 0.9);
    ctx.fillRect(0, 0, SIZE, SIZE);
    addGrid(ctx, SIZE / 3, shade(palette.ceiling, 0.65), 2);
    addSpeckle(ctx, `steel-ceiling-${palette.ceiling}`, 0.4);
    addStains(
      ctx,
      `steel-ceiling-rust-${palette.ceiling}-${decay}`,
      decay,
      shade(palette.accent, 0.5),
    );
    return asTexture(canvas, 1);
  },
};

// ---------------------------------------------------------------------------
// L3 — rustedUtility: block wall, sealed concrete floor, cable-tray ceiling.
// ---------------------------------------------------------------------------
const rustedUtility: SurfacePainter = {
  wall(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.wall;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addBlockCourses(ctx, 22, 44, shade(palette.wall, 0.6));
    addSpeckle(ctx, `block-wall-${palette.wall}`, 0.5);
    addStains(
      ctx,
      `block-wall-rust-${palette.wall}-${decay}`,
      decay * 1.3,
      shade(palette.accent, 0.55),
    );
    return asTexture(canvas, 1);
  },
  floor(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = shade(palette.floor, 0.95);
    ctx.fillRect(0, 0, SIZE, SIZE);
    mottledFill(ctx, palette.floor, `sealed-floor-${palette.floor}`, 0.08);
    addStains(
      ctx,
      `sealed-floor-stains-${palette.floor}-${decay}`,
      decay,
      shade(palette.floor, 0.4),
    );
    return asTexture(canvas, 1);
  },
  ceiling(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.ceiling;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addSpeckle(ctx, `tray-ceiling-${palette.ceiling}`, 0.4);
    // Cable-tray suggestion: a few long straight dark stripes.
    ctx.fillStyle = shade(palette.ceiling, 0.55);
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(0, 40 + i * 60, SIZE, 6);
    }
    addStains(
      ctx,
      `tray-ceiling-stains-${palette.ceiling}-${decay}`,
      decay * 0.8,
      shade(palette.ceiling, 0.5),
    );
    return asTexture(canvas, 1);
  },
};

// ---------------------------------------------------------------------------
// L4 — officeDrywall: bleached drywall, low-pile carpet, drop tiles.
// ---------------------------------------------------------------------------
const officeDrywall: SurfacePainter = {
  wall(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.wall;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Faint drywall panel seams.
    ctx.fillStyle = shade(palette.wall, 0.95);
    for (let x = 0; x < SIZE; x += 48) ctx.fillRect(x, 0, 1, SIZE);
    addSpeckle(ctx, `drywall-${palette.wall}`, 0.35);
    addStains(
      ctx,
      `drywall-stains-${palette.wall}-${decay}`,
      decay * 0.8,
      shade(palette.wall, 0.55),
    );
    return asTexture(canvas, 1);
  },
  floor(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.floor;
    ctx.fillRect(0, 0, SIZE, SIZE);
    mottledFill(ctx, palette.floor, `office-carpet-${palette.floor}`, 0.12);
    addStains(
      ctx,
      `office-carpet-stains-${palette.floor}-${decay}`,
      decay,
      shade(palette.floor, 0.45),
    );
    return asTexture(canvas, 1);
  },
  ceiling(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.ceiling;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addSpeckle(ctx, `office-ceiling-${palette.ceiling}`, 0.4);
    addGrid(ctx, SIZE / 2, shade(palette.ceiling, 0.8), 2.5);
    addStains(
      ctx,
      `office-ceiling-stains-${palette.ceiling}-${decay}`,
      decay * 0.6,
      shade(palette.ceiling, 0.5),
    );
    return asTexture(canvas, 1);
  },
};

// ---------------------------------------------------------------------------
// L5 — hotelPaper: patterned paper + wainscot, figured carpet.
// ---------------------------------------------------------------------------
const hotelPaper: SurfacePainter = {
  wall(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.wall;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Damask diamond motif: crossed diagonal stripes above the wainscot.
    ctx.strokeStyle = shade(palette.accent, 0.7);
    ctx.lineWidth = 1.5;
    for (let d = -SIZE; d <= SIZE; d += 20) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + SIZE, SIZE - 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(d, SIZE - 24);
      ctx.lineTo(d + SIZE, 0);
      ctx.stroke();
    }
    addSpeckle(ctx, `hotel-wall-${palette.wall}`, 0.3);
    addStains(ctx, `hotel-wall-stains-${palette.wall}-${decay}`, decay, shade(palette.wall, 0.4));
    // Wainscot band, taller/richer than the plain skirting.
    ctx.fillStyle = shade(palette.accent, 0.65);
    ctx.fillRect(0, SIZE - 24, SIZE, 24);
    return asTexture(canvas, 1);
  },
  floor(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.floor;
    ctx.fillRect(0, 0, SIZE, SIZE);
    mottledFill(ctx, palette.floor, `hotel-floor-${palette.floor}`, 0.15);
    addBlotches(
      ctx,
      `hotel-floor-pattern-${palette.floor}`,
      24,
      shade(palette.accent, 0.6),
      [0.08, 0.16],
      [10, 22],
    );
    addStains(
      ctx,
      `hotel-floor-stains-${palette.floor}-${decay}`,
      decay,
      shade(palette.floor, 0.4),
    );
    return asTexture(canvas, 1);
  },
  ceiling(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.ceiling;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addSpeckle(ctx, `hotel-ceiling-${palette.ceiling}`, 0.4);
    addGrid(ctx, SIZE / 2, shade(palette.ceiling, 0.78), 2.5);
    addStains(
      ctx,
      `hotel-ceiling-stains-${palette.ceiling}-${decay}`,
      decay * 0.7,
      shade(palette.ceiling, 0.5),
    );
    return asTexture(canvas, 1);
  },
};

// ---------------------------------------------------------------------------
// L6 — voidBlack: near-black everything, no legible detail.
// ---------------------------------------------------------------------------
const voidBlack: SurfacePainter = {
  wall(palette) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.wall;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addSpeckle(ctx, `void-wall-${palette.wall}`, 0.2, 900);
    return asTexture(canvas, 1);
  },
  floor(palette) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.floor;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addSpeckle(ctx, `void-floor-${palette.floor}`, 0.2, 900);
    return asTexture(canvas, 1);
  },
  ceiling(palette) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.ceiling;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addSpeckle(ctx, `void-ceiling-${palette.ceiling}`, 0.15, 600);
    return asTexture(canvas, 1);
  },
};

// ---------------------------------------------------------------------------
// L7 — wetTile: glazed tile with grout, standing-water sheen.
// ---------------------------------------------------------------------------
const wetTile: SurfacePainter = {
  wall(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = shade(palette.wall, 1.05);
    ctx.fillRect(0, 0, SIZE, SIZE);
    addGrid(ctx, SIZE / 6, shade(palette.wall, 0.6), 2);
    addStains(
      ctx,
      `wet-wall-mildew-${palette.wall}-${decay}`,
      decay * 1.2,
      shade(palette.wall, 0.35),
    );
    return asTexture(canvas, 1);
  },
  floor(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = shade(palette.floor, 1.05);
    ctx.fillRect(0, 0, SIZE, SIZE);
    addGrid(ctx, SIZE / 6, shade(palette.floor, 0.55), 2);
    // Standing-water sheen: a lighter horizontal streak band.
    ctx.fillStyle = shade(palette.light, 1);
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(0, 30 + i * 55, SIZE, 10);
    }
    ctx.globalAlpha = 1;
    addStains(ctx, `wet-floor-stains-${palette.floor}-${decay}`, decay, shade(palette.floor, 0.4));
    return asTexture(canvas, 1);
  },
  ceiling(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.ceiling;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addSpeckle(ctx, `wet-ceiling-${palette.ceiling}`, 0.5);
    addStains(
      ctx,
      `wet-ceiling-stains-${palette.ceiling}-${decay}`,
      decay * 1.1,
      shade(palette.ceiling, 0.4),
    );
    return asTexture(canvas, 1);
  },
};

// ---------------------------------------------------------------------------
// L8 — bareRock: mottled stone, no tiles, no skirting.
// ---------------------------------------------------------------------------
const bareRock: SurfacePainter = {
  wall(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.wall;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addBlotches(
      ctx,
      `rock-wall-${palette.wall}`,
      40,
      shade(palette.wall, 0.7),
      [0.1, 0.22],
      [14, 34],
    );
    addBlotches(
      ctx,
      `rock-wall-light-${palette.wall}`,
      20,
      shade(palette.wall, 1.2),
      [0.06, 0.14],
      [8, 20],
    );
    addSpeckle(ctx, `rock-wall-speckle-${palette.wall}`, 0.5);
    addStains(ctx, `rock-wall-stains-${palette.wall}-${decay}`, decay, shade(palette.wall, 0.4));
    return asTexture(canvas, 1);
  },
  floor(palette, decay) {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = shade(palette.floor, 0.95);
    ctx.fillRect(0, 0, SIZE, SIZE);
    addBlotches(
      ctx,
      `rock-floor-${palette.floor}`,
      46,
      shade(palette.floor, 0.65),
      [0.1, 0.22],
      [10, 26],
    );
    addSpeckle(ctx, `rock-floor-speckle-${palette.floor}`, 0.5);
    addStains(ctx, `rock-floor-stains-${palette.floor}-${decay}`, decay, shade(palette.floor, 0.4));
    return asTexture(canvas, 1);
  },
  ceiling(palette, decay) {
    // Deliberately no tile grid: the shared drop-ceiling grid is the single
    // most out-of-place thing this style must avoid.
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = palette.ceiling;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addBlotches(
      ctx,
      `rock-ceiling-${palette.ceiling}`,
      34,
      shade(palette.ceiling, 0.7),
      [0.1, 0.2],
      [12, 30],
    );
    addSpeckle(ctx, `rock-ceiling-speckle-${palette.ceiling}`, 0.45);
    addStains(
      ctx,
      `rock-ceiling-stains-${palette.ceiling}-${decay}`,
      decay,
      shade(palette.ceiling, 0.4),
    );
    return asTexture(canvas, 1);
  },
};

export const SURFACE_PAINTERS: Record<SurfaceStyle, SurfacePainter> = {
  dampWallpaper,
  rawConcrete,
  rivetedSteel,
  rustedUtility,
  officeDrywall,
  hotelPaper,
  voidBlack,
  wetTile,
  bareRock,
};
