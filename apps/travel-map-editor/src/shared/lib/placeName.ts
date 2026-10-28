import { normalizeLocale } from "@app/i18n/locale";
import { localize, Localized } from "@travelmap/core";
import i18next from "i18next";

/**
 * Selects the current translation without changing identifiers or saved names.
 * Callers rendering this value subscribe to language changes with useLanguage.
 * @param {Localized | null | undefined} place - Place to display
 * @param {string} [fallback=""] - Text for a missing reference
 * @param {string} [locale] - Explicit language, otherwise the editor language
 * @returns {string} Translated name with a stable base-name fallback
 */
export function placeName(
  place: Localized | null | undefined,
  fallback = "",
  locale = normalizeLocale(i18next.resolvedLanguage ?? i18next.language),
): string {
  return place ? localize(place, locale) : fallback;
}
