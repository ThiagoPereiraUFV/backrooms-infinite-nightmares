import { Registry } from "../registry";

/** Which shared per-level material a piece is rendered with. */
export type FurnitureMaterialRole = "wood" | "fabric" | "metal" | "stone";

/**
 * One furniture kind, described as pure data. Adding a new piece is a catalog
 * entry plus a geometry builder on the render side — no engine edits.
 */
export interface FurnitureDef {
  id: string;
  /** Collision footprint half-extents in meters (local X/Z, yaw 0). */
  halfX: number;
  halfZ: number;
  /** Height in meters (visual; collision is full-height columns). */
  height: number;
  /** Whether other pieces may be piled on top of this one. */
  stackable: boolean;
  /** Relative eagerness to appear in clusters/piles (multiplies weight). */
  clusterAffinity: number;
  materialRole: FurnitureMaterialRole;
}

export const FURNITURE_CATALOG: readonly FurnitureDef[] = [
  {
    id: "chair",
    halfX: 0.25,
    halfZ: 0.25,
    height: 0.9,
    stackable: false,
    clusterAffinity: 3,
    materialRole: "wood",
  },
  {
    id: "table",
    halfX: 0.8,
    halfZ: 0.45,
    height: 0.75,
    stackable: true,
    clusterAffinity: 2,
    materialRole: "wood",
  },
  {
    id: "couch",
    halfX: 1.0,
    halfZ: 0.45,
    height: 0.8,
    stackable: false,
    clusterAffinity: 1,
    materialRole: "fabric",
  },
  {
    id: "bed",
    halfX: 1.0,
    halfZ: 0.75,
    height: 0.6,
    stackable: true,
    clusterAffinity: 1,
    materialRole: "fabric",
  },
  {
    id: "drawer",
    halfX: 0.6,
    halfZ: 0.25,
    height: 1.3,
    stackable: false,
    clusterAffinity: 1,
    materialRole: "wood",
  },
  {
    id: "cabinet",
    halfX: 0.25,
    halfZ: 0.3,
    height: 1.4,
    stackable: false,
    clusterAffinity: 2,
    materialRole: "wood",
  },
  {
    id: "bookshelf",
    halfX: 0.5,
    halfZ: 0.18,
    height: 2.0,
    stackable: false,
    clusterAffinity: 1,
    materialRole: "wood",
  },
  {
    id: "crate",
    halfX: 0.3,
    halfZ: 0.3,
    height: 0.6,
    stackable: true,
    clusterAffinity: 3,
    materialRole: "wood",
  },
  // Level-flavor props (PLAN-4 M21) — same catalog, same placement/collision
  // machinery as the original eight; only the geometry builder and material
  // role differ.
  {
    id: "barrel",
    halfX: 0.3,
    halfZ: 0.3,
    height: 0.9,
    stackable: true,
    clusterAffinity: 2,
    materialRole: "metal",
  },
  {
    id: "pipeStack",
    halfX: 0.35,
    halfZ: 0.35,
    height: 1.0,
    stackable: false,
    clusterAffinity: 2,
    materialRole: "metal",
  },
  {
    id: "valveWheel",
    halfX: 0.15,
    halfZ: 0.15,
    height: 1.1,
    stackable: false,
    clusterAffinity: 1,
    materialRole: "metal",
  },
  {
    id: "transformer",
    halfX: 0.6,
    halfZ: 0.6,
    height: 1.5,
    stackable: false,
    clusterAffinity: 1,
    materialRole: "metal",
  },
  {
    id: "electricalPanel",
    halfX: 0.35,
    halfZ: 0.15,
    height: 1.8,
    stackable: false,
    clusterAffinity: 1,
    materialRole: "metal",
  },
  {
    id: "vendingMachine",
    halfX: 0.4,
    halfZ: 0.35,
    height: 1.9,
    stackable: false,
    clusterAffinity: 1,
    materialRole: "metal",
  },
  {
    id: "waterCooler",
    halfX: 0.2,
    halfZ: 0.2,
    height: 1.1,
    stackable: false,
    clusterAffinity: 1,
    materialRole: "metal",
  },
  {
    id: "luggageCart",
    halfX: 0.5,
    halfZ: 0.35,
    height: 0.9,
    stackable: true,
    clusterAffinity: 1,
    materialRole: "metal",
  },
  {
    id: "rubblePile",
    halfX: 0.5,
    halfZ: 0.5,
    height: 0.4,
    stackable: false,
    clusterAffinity: 2,
    materialRole: "stone",
  },
  {
    id: "stalagmite",
    halfX: 0.3,
    halfZ: 0.3,
    height: 1.6,
    stackable: false,
    clusterAffinity: 1,
    materialRole: "stone",
  },
];

export const furnitureRegistry = new Registry<FurnitureDef>();
for (const def of FURNITURE_CATALOG) furnitureRegistry.register(def);
