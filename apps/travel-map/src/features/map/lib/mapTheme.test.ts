import { describe, expect, it } from "vitest";

import { createCountryFillColor, MAP_THEMES, toOpaqueFill } from "./mapTheme";

describe("country land coloring", () => {
  it("keeps an empty travel map valid in both themes", () => {
    for (const theme of Object.values(MAP_THEMES)) {
      expect(createCountryFillColor([], theme.land)).toBe(theme.land);
    }
  });

  it("retains visited country colors and the unvisited land fallback", () => {
    const countries = [
      { name: "China", fillColor: "hsla(210, 60%, 50%, 0.6)" },
      { name: "Italy", fillColor: "hsla(120, 60%, 50%, 0.6)" },
    ];
    const land = MAP_THEMES.light.land;

    expect(createCountryFillColor(countries, land)).toEqual([
      "match",
      ["get", "name"],
      "China",
      toOpaqueFill(countries[0].fillColor, land),
      "Italy",
      toOpaqueFill(countries[1].fillColor, land),
      land,
    ]);
  });
});
