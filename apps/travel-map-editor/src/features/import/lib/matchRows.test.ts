import { afterEach, describe, expect, it, vi } from "vitest";

import { DatasetSnapshot } from "../../../data/store";
import { findWorldCountryByCode } from "../../../shared/lib/worldCountries";
import { matchRows } from "./matchRows";

const empty: DatasetSnapshot = {
  cities: [],
  countries: [],
  photos: [],
  trips: [],
  config: { path: "site.config.json", value: {} },
};
afterEach(() => vi.unstubAllGlobals());

describe("import place disambiguation", () => {
  it("requires a human choice even when one homonym has far more population", async () => {
    const base = {
      name: "Chaoyang",
      countryCode: "CN",
      timeZone: "Asia/Shanghai",
      coordinates: [116, 39],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            matches: [
              { ...base, key: "first", population: 10000000 },
              { ...base, key: "second", population: 0 },
            ],
          }),
        ),
      ),
    );
    const rows = await matchRows(
      [{ name: "Chaoyang", text: "Chaoyang", line: 1 }],
      empty,
    );
    expect(findWorldCountryByCode("CN")).toBeDefined();
    expect(rows[0]?.disposition).toBe("ambiguous");
    expect(rows[0]?.chosen).toBeUndefined();
    const saved = {
      path: "cities/China/Old/Old.json",
      value: {
        name: "Chaoyang",
        id: "Old",
        countryId: "China",
        coordinates: [116, 39] as [number, number],
        timeZone: "Asia/Shanghai",
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            matches: [
              { ...base, key: "first" },
              { ...base, key: "second" },
            ],
          }),
        ),
      ),
    );
    expect(
      (
        await matchRows([{ name: "Chaoyang", text: "Chaoyang", line: 1 }], {
          ...empty,
          cities: [saved],
        })
      )[0]?.disposition,
    ).toBe("ambiguous");
  });

  it("recognizes a unique existing translation without changing the reference", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ matches: [] }))),
    );
    const dataset = {
      ...empty,
      cities: [
        {
          path: "cities/China/Guangzhou/Guangzhou.json",
          value: {
            id: "Guangzhou",
            name: "Guangzhou",
            nameByLocale: { "zh-CN": "广州" },
            coordinates: [113.25, 23.11667] as [number, number],
            countryId: "China",
            timeZone: "Asia/Shanghai",
          },
        },
      ],
    };
    expect(
      (await matchRows([{ name: "广州", text: "广州", line: 1 }], dataset))[0]
        ?.cityId,
    ).toBe("Guangzhou");
  });
});
