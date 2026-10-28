import { CityJsonSchema } from "@travelmap/core";
import { describe, expect, it, vi } from "vitest";

import { DatasetSnapshot } from "../../../data/store";
import { findWorldCountryByCode } from "../../../shared/lib/worldCountries";
import { WorldCity } from "./gazetteer";
import { planManualPlace, planPlace } from "./placeCreate";

vi.mock("../../../data/dataset", () => ({ locales: () => ["zh-CN"] }));
const empty: DatasetSnapshot = {
  cities: [],
  countries: [],
  trips: [],
  photos: [],
  config: { path: "site.config.json", value: {} },
};
const city: WorldCity = {
  key: "areacity:110105",
  gazetteerKey: "areacity:110105",
  name: "ChaoYang",
  nameByLocale: { "zh-CN": "朝阳区" },
  aliases: ["朝阳", "chao yang"],
  coordinates: [116.4, 39.9],
  countryCode: "CN",
  country: findWorldCountryByCode("CN"),
  timeZone: "Asia/Shanghai",
};

describe("place identity is independent of display language", () => {
  it("creates a stable ASCII id and Chinese name without configured translation fields", () => {
    const plan = planPlace(empty, city)!;
    const saved = CityJsonSchema.parse(plan.writes.at(-1)?.value);
    expect(saved.id).toBe("Areacity110105");
    expect(saved.nameByLocale?.["zh-CN"]).toBe("朝阳区");
    expect(saved.gazetteerKey).toBe(city.gazetteerKey);
    const dataset = {
      ...empty,
      cities: [{ path: plan.writes.at(-1)!.path, value: saved }],
    };
    expect(planPlace(dataset, { ...city, name: "朝阳区" })?.isExisting).toBe(
      true,
    );
  });

  it("does not merge homonyms or different source identities at the same coordinate", () => {
    const saved = CityJsonSchema.parse(
      planPlace(empty, city)!.writes.at(-1)?.value,
    );
    const dataset = {
      ...empty,
      cities: [{ path: "cities/China/old/old.json", value: saved }],
    };
    expect(
      planPlace(dataset, {
        ...city,
        key: "other",
        gazetteerKey: "areacity:220104",
      })?.isExisting,
    ).toBe(false);
    expect(
      planPlace(
        {
          ...dataset,
          cities: [
            {
              ...dataset.cities[0]!,
              value: {
                ...saved,
                gazetteerKey: undefined,
                coordinates: [125.3, 43.8],
              },
            },
          ],
        },
        city,
      )?.isExisting,
    ).toBe(false);
  });

  it("reuses an unambiguous nearby legacy document and preserves its original id", () => {
    const legacy = {
      id: "OldPath",
      name: "ChaoYang",
      coordinates: city.coordinates,
      countryId: "China",
      timeZone: "Asia/Shanghai",
    };
    const plan = planPlace(
      {
        ...empty,
        cities: [{ path: "cities/China/OldPath/OldPath.json", value: legacy }],
      },
      city,
    );
    expect(plan?.cityId).toBe("OldPath");
    expect(plan?.writes).toEqual([]);
    expect(CityJsonSchema.parse(legacy).gazetteerKey).toBeUndefined();
  });

  it("gives a manual Chinese place a nonempty legal id", () => {
    const plan = planManualPlace(
      empty,
      "我的营地",
      "China",
      [110, 30],
      "Asia/Shanghai",
    );
    expect(plan.cityId).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);
    expect(
      CityJsonSchema.parse(plan.writes[0]?.value).nameByLocale?.["zh-CN"],
    ).toBe("我的营地");
  });
});
