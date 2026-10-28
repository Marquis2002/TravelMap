import { describe, expect, it } from "vitest";

import { placeName } from "./placeName";

describe("localized place display", () => {
  it("uses Chinese when supplied and falls back to the stable base name", () => {
    const city = { name: "Guangzhou", nameByLocale: { "zh-CN": "广州" } };
    expect(placeName(city, "", "zh-CN")).toBe("广州");
    expect(placeName(city, "", "it-IT")).toBe("Guangzhou");
    expect(placeName({ name: "Rome" }, "", "zh-CN")).toBe("Rome");
    expect(placeName(undefined, "OldId", "zh-CN")).toBe("OldId");
  });
});
