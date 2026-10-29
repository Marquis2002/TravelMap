import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { coveredProvinces, loadProvinces, Province } from "./provinces";

afterEach(() => vi.unstubAllGlobals());

describe("China provincial coverage", () => {
  it("uses 34 map regions, deduplicates visits, and includes Hong Kong, Macao and Taiwan", async () => {
    const raw = readFileSync(
      new URL(
        "../../../../public/maps/china-provinces.geojson",
        import.meta.url,
      ),
      "utf8",
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(raw)));
    const provinces = await loadProvinces("/maps/china-provinces.geojson");
    expect(provinces).toHaveLength(34);
    expect(coveredProvinces([], provinces).size).toBe(0);
    expect(
      [
        ...coveredProvinces(
          [
            [113.25, 23.11667],
            [113.25, 23.11667],
            [109.505, 18.24306],
            [114.16, 22.3],
            [113.55, 22.19],
            [121.56, 25.03],
            [2.35, 48.86],
          ],
          provinces,
        ),
      ].sort(),
    ).toEqual([440000, 460000, 710000, 810000, 820000]);
  });

  it("does not treat polygon holes as visited land", () => {
    const provinces: Province[] = [
      {
        code: 1,
        name: "Test",
        polygons: [
          [
            [
              [0, 0],
              [4, 0],
              [4, 4],
              [0, 4],
              [0, 0],
            ],
            [
              [1, 1],
              [3, 1],
              [3, 3],
              [1, 3],
              [1, 1],
            ],
          ],
        ],
      },
    ];
    expect(coveredProvinces([[2, 2]], provinces).size).toBe(0);
  });

  it("rejects failed downloads instead of displaying false zero coverage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 500 })),
    );
    await expect(
      loadProvinces("/maps/china-provinces.geojson"),
    ).rejects.toThrow();
  });
});
