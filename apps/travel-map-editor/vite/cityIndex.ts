import { readFile } from "node:fs/promises";

import type { Plugin, ViteDevServer } from "vite";
import { z } from "zod";

import {
  CityMatch,
  CityMatchSchema,
  rankCities,
} from "../src/shared/lib/cityMatch.ts";
import { assertLocalRequest, sendError, sendJson } from "./http.ts";

const MINIMUM_POPULATION = 5_000;
const DEFAULT_LIMIT = 30;

const CoordinateQuerySchema = z.strictObject({
  lat: z
    .string()
    .trim()
    .min(1)
    .pipe(z.coerce.number<string>().min(-90).max(90)),
  lon: z
    .string()
    .trim()
    .min(1)
    .pipe(z.coerce.number<string>().min(-180).max(180)),
});
const SearchQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  limit: z
    .string()
    .regex(/^\d+$/)
    .pipe(z.coerce.number<string>().int().min(1).max(100))
    .optional(),
});

let gazetteer: CityMatch[] | undefined;
let lookupTimeZone:
  ((latitude: number, longitude: number) => string) | undefined;

/**
 * Loads and filters the gazetteer on first lookup. Both packages are CommonJS
 * and read several megabytes from disk, so they stay on the Node side of the dev
 * server and out of its startup path until an author actually searches.
 * @returns {Promise<CityMatch[]>} Chinese administrative places and the existing world catalogue
 */
async function loadGazetteer(): Promise<CityMatch[]> {
  if (gazetteer) return gazetteer;
  const [{ default: cities }, { default: tzLookup }] = await Promise.all([
    import("all-the-cities"),
    import("tz-lookup"),
  ]);
  lookupTimeZone = tzLookup;
  const local = z
    .array(CityMatchSchema)
    .parse(
      JSON.parse(
        await readFile(
          new URL("./data/chinaPlaces.json", import.meta.url),
          "utf8",
        ),
      ),
    );
  const merged = new Set(local.flatMap((city) => city.legacyKeys ?? []));
  gazetteer = [
    ...local,
    ...cities
      .filter(
        (city) =>
          city.population >= MINIMUM_POPULATION &&
          !merged.has(String(city.cityId)),
      )
      .map((city) => ({
        coordinates: city.loc.coordinates,
        countryCode: city.country,
        key: String(city.cityId),
        gazetteerKey: `geonames:${city.cityId}`,
        name: city.name,
        population: city.population || undefined,
        timeZone: "UTC",
      })),
  ];
  return gazetteer;
}

/**
 * Serves world city lookups from the development server.
 * @returns {Plugin} Serve-only Vite plugin
 */
export function cityIndex(): Plugin {
  return {
    name: "city-index",
    apply: "serve",

    /**
     * Installs the city search and timezone endpoints.
     * @param {ViteDevServer} server - Editor development server
     * @returns {void}
     */
    configureServer(server: ViteDevServer): void {
      server.middlewares.use("/__cities", async (request, response) => {
        try {
          assertLocalRequest(request);
          if (request.method !== "GET") {
            sendJson(response, 405, { error: "Use GET for city lookups." });
            return;
          }
          const url = new URL(request.url ?? "", "http://localhost");

          if (url.pathname === "/timezone") {
            const coordinates = CoordinateQuerySchema.safeParse(
              Object.fromEntries(url.searchParams),
            );
            if (!coordinates.success) {
              sendJson(response, 400, { error: "Invalid coordinates." });
              return;
            }
            await loadGazetteer();
            sendJson(response, 200, {
              timeZone:
                lookupTimeZone?.(coordinates.data.lat, coordinates.data.lon) ??
                "UTC",
            });
            return;
          }

          const query = SearchQuerySchema.safeParse(
            Object.fromEntries(url.searchParams),
          );
          if (!query.success) {
            sendJson(response, 400, {
              error: "Invalid city search parameters.",
            });
            return;
          }
          const term = query.data.q;
          if (term.length < 2) {
            sendJson(response, 200, { matches: [] });
            return;
          }
          const cities = await loadGazetteer();
          const limit = query.data.limit ?? DEFAULT_LIMIT;
          sendJson(response, 200, {
            matches: rankCities(cities, term, limit).map((city) => ({
              ...city,
              timeZone:
                city.timeZone === "UTC"
                  ? (lookupTimeZone?.(
                      city.coordinates[1],
                      city.coordinates[0],
                    ) ?? "UTC")
                  : city.timeZone,
            })),
          });
        } catch (error) {
          sendError(response, error, "City lookup failed.");
        }
      });
    },
  };
}
