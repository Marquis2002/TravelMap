import { z } from "zod";

const positionSchema = z.tuple([z.number(), z.number()]);
const polygonSchema = z.array(z.array(positionSchema).min(4)).min(1);

/* Upstream GeoJSON carries additional metadata that this reader does not own. */
const boundarySchema = z.looseObject({
  features: z.array(
    z.looseObject({
      properties: z.looseObject({
        adcode: z.coerce.number(),
        name: z.string().optional(),
        level: z.string().optional(),
      }),
      geometry: z.discriminatedUnion("type", [
        z.looseObject({
          type: z.literal("Polygon"),
          coordinates: polygonSchema,
        }),
        z.looseObject({
          type: z.literal("MultiPolygon"),
          coordinates: z.array(polygonSchema),
        }),
      ]),
    }),
  ),
});

/** Longitude and latitude for a visited place. */
type Position = z.infer<typeof positionSchema>;

/**
 * A provincial region from the same boundary asset used by the map.
 * @property {number} code - Stable administrative code
 * @property {string} name - Source display name
 * @property {Position[][][]} polygons - Polygon shells and holes
 */
export interface Province {
  code: number;
  name: string;
  polygons: Position[][][];
}

/**
 * Loads local province shapes without adding them to the initial JavaScript bundle.
 * @param {string} url - Local map asset URL
 * @returns {Promise<Province[]>} Exactly 34 validated provincial regions
 */
export async function loadProvinces(url: string): Promise<Province[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Province map unavailable");
  const data = boundarySchema.parse(await response.json());
  const provinces = data.features.flatMap(({ properties, geometry }) =>
    properties.level === "province" && properties.name
      ? [
          {
            code: properties.adcode,
            name: properties.name,
            polygons:
              geometry.type === "Polygon"
                ? [geometry.coordinates]
                : geometry.coordinates,
          },
        ]
      : [],
  );
  if (
    provinces.length !== 34 ||
    new Set(provinces.map((p) => p.code)).size !== 34
  )
    throw new Error("Expected 34 unique provinces");
  return provinces;
}

/**
 * Tests a ring with ray casting, treating boundary points as inside.
 * @param {Position} point - Place coordinate
 * @param {Position[]} ring - Closed boundary ring
 * @returns {boolean} Whether the point lies within or on the ring
 */
function insideRing(point: Position, ring: Position[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    const cross = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
    if (
      Math.abs(cross) < 1e-10 &&
      x >= Math.min(a[0], b[0]) &&
      x <= Math.max(a[0], b[0]) &&
      y >= Math.min(a[1], b[1]) &&
      y <= Math.max(a[1], b[1])
    )
      return true;
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

/**
 * Counts each province once using actual visited coordinates, never names or nearby centroids.
 * @param {Position[]} points - Coordinates already filtered to visited places
 * @param {Province[]} provinces - Validated province geometry
 * @returns {Set<number>} Covered administrative codes
 */
export function coveredProvinces(
  points: Position[],
  provinces: Province[],
): Set<number> {
  const covered = new Set<number>();
  for (const point of points) {
    const province = provinces.find(({ polygons }) =>
      polygons.some(
        ([shell, ...holes]) =>
          shell &&
          insideRing(point, shell) &&
          !holes.some((hole) => insideRing(point, hole)),
      ),
    );
    if (province) covered.add(province.code);
  }
  return covered;
}
