import { LoaderFunctionArgs, RouterContextProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { galleryLoader } from "./Gallery.loader";

vi.mock("@/data/world", async () => {
  const { buildWorld } = await import("@travelmap/core");
  const world = buildWorld({
    countries: [
      {
        id: "China",
        name: "China",
        continent: "ASIA",
        currency: "CNY",
        color: { h: 0, s: 50, l: 50 },
      },
    ],
    cities: ["BeijingChaoyang", "ChangchunChaoyang", "Guangzhou"].map((id) => ({
      id,
      name: id === "Guangzhou" ? id : "ChaoYang",
      countryId: "China",
      coordinates: [116, 39],
      timeZone: "Asia/Shanghai",
    })),
    trips: [
      {
        id: "test",
        title: "Test",
        originCityId: "Guangzhou",
        sDate: "2020-01-01",
        eDate: "2020-01-04",
        steps: ["BeijingChaoyang", "ChangchunChaoyang", "Guangzhou"].map(
          (cityId, index) => ({
            type: "stay",
            cityId,
            checkIn: `2020-01-0${index + 1}`,
            checkOut: `2020-01-0${index + 2}`,
            photoPath: cityId,
          }),
        ),
      },
    ],
    photos: Object.fromEntries(
      ["BeijingChaoyang", "ChangchunChaoyang", "Guangzhou"].map((id) => [
        id,
        [
          {
            original: `/${id}.webp`,
            thumbnail: `/${id}t.webp`,
            width: 4,
            height: 3,
          },
        ],
      ]),
    ),
  });
  return {
    visitedCities: Array.from(world.citiesById.values()),
    visitedTrips: world.trips,
  };
});

/**
 * Builds a router request without any browser or user data.
 * @param {string} cityName - Stable route identifier or legacy name
 * @returns {LoaderFunctionArgs} Loader arguments
 */
function request(cityName: string): LoaderFunctionArgs {
  return {
    request: new Request("http://localhost/"),
    url: new URL("http://localhost/"),
    pattern: "/gallery/:cityName/:travelIdx",
    params: { cityName, travelIdx: "0" },
    context: new RouterContextProvider(),
  };
}

describe("gallery place identities", () => {
  it("keeps identically named districts in separate albums", () => {
    for (const id of ["BeijingChaoyang", "ChangchunChaoyang"])
      expect(galleryLoader(request(id)).travel.photos[0]?.original).toBe(
        `/${id}.webp`,
      );
    expect(() => galleryLoader(request("ChaoYang"))).toThrow();
  });

  it("keeps the original Guangzhou route working", () => {
    expect(galleryLoader(request("Guangzhou")).city.id).toBe("Guangzhou");
  });
});
