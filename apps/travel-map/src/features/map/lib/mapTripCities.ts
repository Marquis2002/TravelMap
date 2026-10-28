import { City, Trip } from "@travelmap/core";

/**
 * Adds a city when no regular marker already represents it.
 * @param {City | undefined} city - The optional city to add
 * @param {Set<string>} knownCityIds - IDs represented by regular markers
 * @param {Map<string, City>} auxiliaryCities - Auxiliary markers collected so far
 * @returns {void}
 */
function addAuxiliaryCity(
  city: City | undefined,
  knownCityIds: Set<string>,
  auxiliaryCities: Map<string, City>,
): void {
  if (city && !knownCityIds.has(city.id)) {
    auxiliaryCities.set(city.id, city);
  }
}

/**
 * Collects every city the trip only passed through — its origin, airports,
 * changes, and the ports a ferry called at — that has no regular marker.
 * @param {Trip} trip - The trip whose pass-through cities should be collected
 * @param {City[]} existingCities - Cities already represented on the map
 * @returns {City[]} The cities that still need markers
 */
export function getTripLayoverCities(
  trip: Trip,
  existingCities: City[],
): City[] {
  const knownCityIds = new Set(existingCities.map((city) => city.id));
  const auxiliaryCities = new Map<string, City>();

  for (const city of [
    ...trip.getPassThroughCities(),
    ...trip.getLegs().flatMap((leg) => [leg.from, leg.to]),
    trip.returnTo,
  ])
    addAuxiliaryCity(city, knownCityIds, auxiliaryCities);

  return Array.from(auxiliaryCities.values());
}
