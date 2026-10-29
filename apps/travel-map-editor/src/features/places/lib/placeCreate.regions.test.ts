import { CityJsonSchema } from "@travelmap/core";
import { expect, it, vi } from "vitest";

import { findWorldCountryByCode } from "../../../shared/lib/worldCountries";
import { WorldCity } from "./gazetteer";
import { planPlace } from "./placeCreate";

vi.mock("../../../data/dataset", () => ({ locales: () => ["zh-CN"] }));

it("creates Taiwan cities under China and reuses the migrated city without changing its id", () => {
  const country = findWorldCountryByCode("TW");
  expect(country).toBe(findWorldCountryByCode("CN"));
  const city: WorldCity = {
    key: "taipei",
    name: "Taipei",
    countryCode: "TW",
    country,
    coordinates: [121.5654, 25.033],
    timeZone: "Asia/Taipei",
  };
  const empty = {
    countries: [],
    cities: [],
    trips: [],
    photos: [],
    config: { path: "site.config.json", value: {} },
  };
  const plan = planPlace(empty, city)!;
  const saved = CityJsonSchema.parse(plan.writes.at(-1)?.value);
  expect(saved.countryId).toBe("China");
  expect(plan.writes.at(-1)?.path).toBe("cities/China/Taipei/Taipei.json");
  expect(
    planPlace(
      {
        ...empty,
        cities: [{ path: "cities/Taiwan/Taipei/Taipei.json", value: saved }],
      },
      city,
    )?.cityId,
  ).toBe("Taipei");
  expect(
    planPlace(
      {
        ...empty,
        cities: [{ path: "cities/Taiwan/Taipei/Taipei.json", value: saved }],
      },
      city,
    )?.writes,
  ).toEqual([]);
});
