import { describe, expect, it } from "vitest";
import { z } from "zod";

import raw from "../../../vite/data/chinaPlaces.json";
import { CityMatchSchema, cityRegion, rankCities } from "./cityMatch";

const cities = z.array(CityMatchSchema).parse(raw);

describe("offline Chinese gazetteer", () => {
  it("finds one Guangzhou identity through Chinese, English and spaced pinyin", () => {
    for (const query of ["广州", "广州市", "Guangzhou", "guang zhou"]) {
      expect(rankCities(cities, query, 1)[0]?.key).toBe("areacity:4401");
    }
    for (const query of ["西安", "xian", "xi’an"]) {
      expect(rankCities(cities, query, 1)[0]?.key).toBe("areacity:6101");
    }
  });

  it("covers counties without population and all thirteen agreed major destinations", () => {
    for (const query of [
      "三亚",
      "阳朔县",
      "稻城县",
      "朝阳区",
      "济源",
      "香港",
      "澳门",
      "台北",
      "新北",
      "桃园",
      "台中",
      "台南",
      "高雄",
      "基隆",
      "新竹",
      "嘉义",
      "花莲",
      "台东",
    ]) {
      expect(
        rankCities(cities, query, 10).some((city) =>
          city.nameByLocale?.["zh-CN"]?.includes(query),
        ),
      ).toBe(true);
    }
    expect(rankCities(cities, "稻城县", 1)[0]?.population).toBeUndefined();
  });

  it("disambiguates districts by province and prefecture without collapsing names", () => {
    const matches = rankCities(cities, "朝阳区", 30);
    expect(matches.length).toBeGreaterThan(1);
    expect(matches.map(cityRegion)).toContain("北京市");
    expect(matches.map(cityRegion)).toContain("吉林省 · 长春市");
    expect(rankCities(cities, "北京 朝阳", 1)[0]?.key).toBe("areacity:110105");
    expect(rankCities(cities, "吉林 长春 朝阳", 1)[0]?.key).toBe(
      "areacity:220104",
    );
  });

  it("keeps real nodes unique and removes municipality and direct-city filler levels", () => {
    expect(cities).toHaveLength(3195);
    expect(new Set(cities.map((city) => city.key)).size).toBe(cities.length);
    expect(cities.some((city) => city.key === "areacity:1101")).toBe(false);
    expect(cities.some((city) => city.key === "areacity:441900")).toBe(false);
    expect(cities.some((city) => city.key === "areacity:4419")).toBe(true);
    expect(cities.some((city) => city.key === "areacity:419001000")).toBe(
      false,
    );
  });

  it("ranks exact before prefix before substring and cities before homonymous counties", () => {
    const base = cities[0]!;
    const candidates = [
      {
        ...base,
        key: "contains",
        name: "New Test",
        aliases: [],
        nameByLocale: {},
      },
      {
        ...base,
        key: "prefix",
        name: "Testton",
        aliases: [],
        nameByLocale: {},
      },
      {
        ...base,
        key: "county",
        name: "Test",
        adminLevel: "county" as const,
        aliases: [],
        nameByLocale: {},
      },
      {
        ...base,
        key: "city",
        name: "Test",
        adminLevel: "city" as const,
        aliases: [],
        nameByLocale: {},
      },
    ];
    expect(rankCities(candidates, "test", 4).map((city) => city.key)).toEqual([
      "city",
      "county",
      "prefix",
      "contains",
    ]);
    expect(
      rankCities(
        [
          {
            ...base,
            key: "rome",
            name: "Roma",
            countryCode: "IT",
            aliases: ["Rome"],
          },
        ],
        "Rome",
        1,
      )[0]?.countryCode,
    ).toBe("IT");
  });
});
