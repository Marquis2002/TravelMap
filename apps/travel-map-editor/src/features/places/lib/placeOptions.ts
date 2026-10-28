import { DatasetSnapshot } from "../../../data/store";
import { ComboboxOption } from "../../../shared/components/Combobox/Combobox";
import { placeName } from "../../../shared/lib/placeName";
import { findWorldCountry } from "../../../shared/lib/worldCountries";

/**
 * Builds the country choices, each carrying its flag.
 * @param {DatasetSnapshot} dataset - The current dataset
 * @returns {ComboboxOption[]} Country options
 */
export function countryOptions(dataset: DatasetSnapshot): ComboboxOption[] {
  return dataset.countries.map(({ value }) => ({
    iconUrl: findWorldCountry(value.id)?.flagUrl,
    label: placeName(value),
    value: value.id,
    searchNames: [value.name, ...Object.values(value.nameByLocale ?? {})],
  }));
}

/**
 * Builds the city choices, each hinted with its country and flag.
 * @param {DatasetSnapshot} dataset - The current dataset
 * @returns {ComboboxOption[]} City options
 */
export function cityOptions(dataset: DatasetSnapshot): ComboboxOption[] {
  return dataset.cities.map(({ value }) => ({
    hint: placeName(
      dataset.countries.find(
        ({ value: country }) => country.id === value.countryId,
      )?.value,
      value.countryId,
    ),
    iconUrl: findWorldCountry(value.countryId)?.flagUrl,
    label: placeName(value),
    value: value.id,
    searchNames: [value.name, ...Object.values(value.nameByLocale ?? {})],
  }));
}

/**
 * Lists the IANA timezones as searchable options.
 * @returns {ComboboxOption[]} Timezone options
 */
export function timeZoneOptions(): ComboboxOption[] {
  return Intl.supportedValuesOf("timeZone").map((timeZone) => ({
    label: timeZone,
    value: timeZone,
  }));
}

/**
 * Indexes city coordinates by id, so leg derivation can look them up without
 * scanning the dataset for every step.
 * @param {DatasetSnapshot} dataset - The current dataset
 * @returns {Map<string, [number, number]>} Coordinates keyed by city id
 */
export function cityCoordinates(
  dataset: DatasetSnapshot,
): Map<string, [number, number]> {
  return new Map(
    dataset.cities.map(({ value }) => [value.id, value.coordinates] as const),
  );
}
