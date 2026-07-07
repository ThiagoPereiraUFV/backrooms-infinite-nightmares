import { Registry } from "../registry";

/** Which shared per-level material a piece is rendered with. */
export type FurnitureMaterialRole = "wood" | "fabric";

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
];

export const furnitureRegistry = new Registry<FurnitureDef>();
for (const def of FURNITURE_CATALOG) furnitureRegistry.register(def);
