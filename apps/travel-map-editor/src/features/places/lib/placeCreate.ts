import { CityJson, CountryJson, deriveLegDistance } from "@travelmap/core";

import { locales } from "../../../data/dataset";
import { cityPath, countryPath, toId, uniqueId } from "../../../data/paths";
import { DatasetSnapshot, DocumentWrite } from "../../../data/store";
import { foldPlaceName } from "../../../shared/lib/cityMatch";
import { translationsForLocales } from "../../../shared/lib/worldCountries";
import { WorldCity } from "./gazetteer";

/**
 * What adding a place to the dataset would do, before anything is written.
 * Returned rather than applied so the editor can disclose the file creations
 * to the author and undo them as one action.
 * @property {string} cityId - The city the itinerary should reference
 * @property {DocumentWrite[]} writes - Documents that would be created
 * @property {string | null} createsCountry - Country created, when new
 * @property {boolean} isExisting - Whether the dataset already had this place
 * @property {string | null} nearbyCityId - An existing city at almost this spot
 */
export interface PlannedPlace {
  cityId: string;
  writes: DocumentWrite[];
  createsCountry: string | null;
  isExisting: boolean;
  nearbyCityId: string | null;
}

/*
 * Successive hues a third of the wheel apart, so countries added one after
 * another never come out looking alike on the map.
 */
const HUE_STEP = 137;
const DEFAULT_SATURATION = 68;
const DEFAULT_LIGHTNESS = 50;

/* Gazetteers may vary slightly for the same pin, but neighbouring cities are distinct. */
const DUPLICATE_RADIUS_KM = 1;

/**
 * Picks a map colour for a newly created country, spaced away from the ones
 * already in the dataset.
 * @param {DatasetSnapshot} dataset - The current dataset
 * @returns {{ h: number; s: number; l: number }} The suggested fill
 */
function nextCountryColor(dataset: DatasetSnapshot): {
  h: number;
  s: number;
  l: number;
} {
  return {
    h: (dataset.countries.length * HUE_STEP) % 360,
    l: DEFAULT_LIGHTNESS,
    s: DEFAULT_SATURATION,
  };
}

/**
 * Finds a city already in the dataset at effectively the same map point.
 * @param {DatasetSnapshot} dataset - The current dataset
 * @param {[number, number]} coordinates - Longitude and latitude
 * @returns {string | null} The nearby city's id, when there is one
 */
export function findNearbyCity(
  dataset: DatasetSnapshot,
  coordinates: [number, number],
): string | null {
  const nearby = dataset.cities.find(
    ({ value }) =>
      deriveLegDistance(value.coordinates, coordinates) <= DUPLICATE_RADIUS_KM,
  );
  return nearby?.value.id ?? null;
}

/**
 * Works out what adding a gazetteer match would create.
 * Reuses stable source identities; legacy documents need both a name match
 * and nearby coordinates in the same country to avoid merging homonyms.
 * @param {DatasetSnapshot} dataset - The current dataset
 * @param {WorldCity} city - The chosen gazetteer entry
 * @returns {PlannedPlace | null} The plan, or null when the country is unknown
 */
export function planPlace(
  dataset: DatasetSnapshot,
  city: WorldCity,
): PlannedPlace | null {
  if (!city.country) return null;

  const nearbyCityId = findNearbyCity(dataset, city.coordinates);
  const names = [
    city.name,
    ...Object.values(city.nameByLocale ?? {}),
    ...(city.aliases ?? []),
  ].map(foldPlaceName);
  const matches = dataset.cities.filter(({ value }) => {
    if (value.countryId !== city.country?.id) return false;
    if (value.gazetteerKey && city.gazetteerKey)
      return value.gazetteerKey === city.gazetteerKey;
    return (
      [value.name, ...Object.values(value.nameByLocale ?? {})].some((name) =>
        names.includes(foldPlaceName(name)),
      ) &&
      deriveLegDistance(value.coordinates, city.coordinates) <=
        DUPLICATE_RADIUS_KM
    );
  });
  const reused = matches.length === 1 ? matches[0]?.value.id : undefined;
  if (reused)
    return {
      cityId: reused,
      createsCountry: null,
      isExisting: true,
      nearbyCityId,
      writes: [],
    };

  const writes: DocumentWrite[] = [];
  const country = city.country;
  const hasCountry = dataset.countries.some(
    ({ value }) => value.id === country.id,
  );

  if (!hasCountry) {
    const document: CountryJson = {
      id: country.id,
      name: country.name,
      nameByLocale: translationsForLocales(country, locales()),
      color: nextCountryColor(dataset),
      continent: country.continent,
      currency: country.currency,
    };
    writes.push({ path: countryPath(country.id), value: document });
  }

  const cityId = uniqueId(
    city.gazetteerKey ? toId(city.gazetteerKey) : toId(city.name),
    dataset.cities.map(({ value }) => value.id),
  );
  const document: CityJson = {
    id: cityId,
    name: city.name,
    nameByLocale: city.nameByLocale,
    gazetteerKey: city.gazetteerKey,
    countryId: country.id,
    coordinates: city.coordinates,
    population: city.population,
    timeZone: city.timeZone,
  };
  writes.push({ path: cityPath(country.id, cityId), value: document });

  return {
    cityId,
    createsCountry: hasCountry ? null : country.name,
    isExisting: false,
    nearbyCityId,
    writes,
  };
}

/**
 * Builds the city document for a point the author placed by hand, for places
 * the gazetteer does not carry.
 * @param {DatasetSnapshot} dataset - The current dataset
 * @param {string} name - The place name
 * @param {string} countryId - The owning country, which must already exist
 * @param {[number, number]} coordinates - Longitude and latitude
 * @param {string} timeZone - The IANA timezone covering the point
 * @returns {PlannedPlace} The plan for the manual place
 */
export function planManualPlace(
  dataset: DatasetSnapshot,
  name: string,
  countryId: string,
  coordinates: [number, number],
  timeZone: string,
): PlannedPlace {
  const cityId = uniqueId(
    toId(name),
    dataset.cities.map(({ value }) => value.id),
  );
  const document: CityJson = {
    id: cityId,
    name,
    nameByLocale: /\p{Script=Han}/u.test(name) ? { "zh-CN": name } : undefined,
    countryId,
    coordinates,
    timeZone,
  };

  return {
    cityId,
    createsCountry: null,
    isExisting: false,
    nearbyCityId: findNearbyCity(dataset, coordinates),
    writes: [{ path: cityPath(countryId, cityId), value: document }],
  };
}
