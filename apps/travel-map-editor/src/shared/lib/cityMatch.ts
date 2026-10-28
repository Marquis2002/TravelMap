import { z } from "zod";

/** Search result contract shared by the Node index and browser response parser. */
export const CityMatchSchema = z.strictObject({
  coordinates: z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ]),
  countryCode: z.string().length(2),
  key: z.string().min(1),
  name: z.string().min(1),
  population: z.number().nonnegative().optional(),
  timeZone: z.string().min(1),
  nameByLocale: z.record(z.string(), z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  adminLevel: z.enum(["city", "county"]).optional(),
  province: z.string().optional(),
  prefecture: z.string().optional(),
  regionAliases: z.array(z.string()).optional(),
  gazetteerKey: z.string().min(1).optional(),
  legacyKeys: z.array(z.string()).optional(),
});

/** A validated search result, without editor-specific country metadata. */
export type CityMatch = z.infer<typeof CityMatchSchema>;

/**
 * Makes spaced pinyin, accents and apostrophes comparable while retaining Han characters.
 * @param {string} value - User input or indexed name
 * @returns {string} Compact comparison key
 */
export function foldPlaceName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s'’‘ʼ-]+/g, "");
}

/**
 * Ranks exact names before prefixes and substrings, allowing region tokens without fuzzy merging.
 * @param {CityMatch[]} cities - Local and world records
 * @param {string} term - Search term, optionally prefixed by province or prefecture
 * @param {number} limit - Maximum number of results
 * @returns {CityMatch[]} Deterministically ranked matches
 */
export function rankCities(
  cities: CityMatch[],
  term: string,
  limit: number,
): CityMatch[] {
  const needle = foldPlaceName(term);
  if (!needle) return [];
  const tokens = term.trim().split(/\s+/).map(foldPlaceName).filter(Boolean);
  const scored = cities.flatMap((city) => {
    const names = [
      city.name,
      ...Object.values(city.nameByLocale ?? {}),
      ...(city.aliases ?? []),
    ].map(foldPlaceName);
    const regions = [
      city.province ?? "",
      city.prefecture ?? "",
      ...(city.regionAliases ?? []),
    ].map(foldPlaceName);
    const direct = names.map((name) =>
      name === needle
        ? 0
        : name.startsWith(needle)
          ? 1
          : name.includes(needle)
            ? 2
            : 3,
    );
    let score = Math.min(...direct);
    if (
      score === 3 &&
      tokens.length > 1 &&
      tokens.every((token) =>
        [...names, ...regions].some((name) => name.includes(token)),
      )
    ) {
      const placeTokens = tokens.filter(
        (token) => !regions.some((region) => region.includes(token)),
      );
      const placeNeedle = placeTokens.join("");
      if (placeNeedle)
        score = Math.min(
          ...names.map((name) =>
            name === placeNeedle
              ? 0
              : name.startsWith(placeNeedle)
                ? 1
                : name.includes(placeNeedle)
                  ? 2
                  : 3,
          ),
        );
    }
    return score < 3 ? [{ city, score }] : [];
  });
  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        Number(a.city.adminLevel === "county") -
          Number(b.city.adminLevel === "county") ||
        Number(!a.city.gazetteerKey) - Number(!b.city.gazetteerKey) ||
        (b.city.population ?? 0) - (a.city.population ?? 0) ||
        a.city.key.localeCompare(b.city.key),
    )
    .slice(0, limit)
    .map(({ city }) => city);
}

/**
 * Supplies administrative context so equal names remain distinguishable in every language.
 * @param {CityMatch} city - Search result
 * @returns {string} Province and prefecture without repeated municipality names
 */
export function cityRegion(city: CityMatch): string {
  return [...new Set([city.province, city.prefecture].filter(Boolean))].join(
    " · ",
  );
}
