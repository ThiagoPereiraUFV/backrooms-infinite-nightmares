import * as THREE from "three";
import type { LevelPalette } from "@/engine/generation/levelProfile";
import { createRng, hashString } from "@/engine/generation/rng";

/**
 * Retro/dated finishes, generated on a canvas once per level: wallpaper with
 * vertical striping, worn carpet, drop-ceiling tiles. Decay drives stains and
 * discoloration. No image assets; every level gets its own look for free.
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

const addSpeckle = (ctx: CanvasRenderingContext2D, seedKey: string, strength: number): void => {
  const rng = createRng(hashString(seedKey));
  for (let i = 0; i < 1800; i++) {
    const bright = rng.chance(0.5);
    ctx.fillStyle = bright ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.05)";
    ctx.globalAlpha = strength;
    ctx.fillRect(rng.next() * SIZE, rng.next() * SIZE, 1 + rng.next() * 2, 1 + rng.next() * 2);
  }
  ctx.globalAlpha = 1;
};

export function createWallTexture(palette: LevelPalette, decay: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = palette.wall;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Monotonous wallpaper striping.
  ctx.fillStyle = shade(palette.wall, 0.92);
  for (let x = 0; x < SIZE; x += 16) {
    ctx.fillRect(x, 0, 6, SIZE);
  }
  ctx.fillStyle = shade(palette.wall, 1.06);
  for (let x = 8; x < SIZE; x += 32) {
    ctx.fillRect(x, 0, 2, SIZE);
  }

  addSpeckle(ctx, `wall-speckle-${palette.wall}`, 0.7);
  addStains(ctx, `wall-stains-${palette.wall}-${decay}`, decay, shade(palette.wall, 0.45));

  // Dated skirting along the bottom edge.
  ctx.fillStyle = shade(palette.accent, 0.8);
  ctx.fillRect(0, SIZE - 14, SIZE, 14);

  return asTexture(canvas, 1);
}

export function createFloorTexture(palette: LevelPalette, decay: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = palette.floor;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Worn carpet / raw slab mottling.
  const rng = createRng(hashString(`floor-${palette.floor}`));
  for (let y = 0; y < SIZE; y += 4) {
    for (let x = 0; x < SIZE; x += 4) {
      const factor = 0.9 + rng.next() * 0.2;
      ctx.fillStyle = shade(palette.floor, factor);
      ctx.fillRect(x, y, 4, 4);
    }
  }

  addStains(ctx, `floor-stains-${palette.floor}-${decay}`, decay * 1.4, shade(palette.floor, 0.4));
  return asTexture(canvas, 1);
}

export function createCeilingTexture(palette: LevelPalette, decay: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = palette.ceiling;
  ctx.fillRect(0, 0, SIZE, SIZE);

  addSpeckle(ctx, `ceiling-speckle-${palette.ceiling}`, 0.5);

  // Drop-ceiling tile grid.
  ctx.strokeStyle = shade(palette.ceiling, 0.75);
  ctx.lineWidth = 3;
  for (let t = 0; t <= SIZE; t += SIZE / 2) {
    ctx.beginPath();
    ctx.moveTo(t, 0);
    ctx.lineTo(t, SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, t);
    ctx.lineTo(SIZE, t);
    ctx.stroke();
  }

  addStains(
    ctx,
    `ceiling-stains-${palette.ceiling}-${decay}`,
    decay * 0.8,
    shade(palette.ceiling, 0.5),
  );
  return asTexture(canvas, 1);
}
