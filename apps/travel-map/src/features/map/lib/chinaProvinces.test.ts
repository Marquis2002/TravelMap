import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const positionSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const ringSchema = positionSchema
  .array()
  .min(4)
  .refine((ring) => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    return first[0] === last[0] && first[1] === last[1];
  });
const boundariesSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      properties: z.object({
        adcode: z.union([z.number(), z.string()]),
        name: z.string().optional(),
        level: z.string().optional(),
        centroid: positionSchema.optional(),
        center: positionSchema.optional(),
      }),
      geometry: z.discriminatedUnion("type", [
        z.object({
          type: z.literal("Polygon"),
          coordinates: ringSchema.array().min(1),
        }),
        z.object({
          type: z.literal("MultiPolygon"),
          coordinates: ringSchema.array().min(1).array().min(1),
        }),
      ]),
    }),
  ),
});
const labelsSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      properties: z.object({
        adcode: z.number(),
        name: z.string().min(1),
        label: z.string().min(1),
      }),
      geometry: z.object({
        type: z.literal("Point"),
        coordinates: positionSchema,
      }),
    }),
  ),
});

/**
 * Reads the checked-in map asset without bundling its coordinates into app code.
 * @param {string} name - File name below public/maps
 * @returns {unknown} Untrusted GeoJSON ready for schema validation
 */
function readMapAsset(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`../../../../public/maps/${name}`, import.meta.url),
      "utf8",
    ),
  );
}

describe("China provincial map assets", () => {
  it("contains valid closed boundaries for all 34 provincial regions", () => {
    const data = boundariesSchema.parse(
      readMapAsset("china-provinces.geojson"),
    );
    const codes = data.features
      .filter(({ properties }) => properties.level === "province")
      .map(({ properties }) => properties.adcode)
      .sort();

    expect(codes).toEqual([
      110000, 120000, 130000, 140000, 150000, 210000, 220000, 230000, 310000,
      320000, 330000, 340000, 350000, 360000, 370000, 410000, 420000, 430000,
      440000, 450000, 460000, 500000, 510000, 520000, 530000, 540000, 610000,
      620000, 630000, 640000, 650000, 710000, 810000, 820000,
    ]);
  });

  it("gives each province exactly one label at its source anchor", () => {
    const data = boundariesSchema.parse(
      readMapAsset("china-provinces.geojson"),
    );
    const labels = labelsSchema.parse(
      readMapAsset("china-province-labels.geojson"),
    );

    expect(labels.features).toHaveLength(34);
    expect(
      new Set(labels.features.map(({ properties }) => properties.adcode)).size,
    ).toBe(34);
    for (const label of labels.features) {
      const source = data.features.find(
        ({ properties }) => properties.adcode === label.properties.adcode,
      );
      expect(source?.properties.name).toBe(label.properties.name);
      expect(label.geometry.coordinates).toEqual(
        source?.properties.centroid ?? source?.properties.center,
      );
    }
  });
});
