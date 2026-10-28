import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { DEFAULT_LOCALE, normalizeLocale, SUPPORTED_LOCALES } from "./locale";

/**
 * Flattens resource trees to compare translated keys and interpolation contracts.
 * @param {unknown} value - Parsed resource JSON
 * @param {string} [prefix=""] - Parent key path
 * @returns {Record<string, string>} Leaf strings keyed by their translation path
 */
function leaves(value: unknown, prefix = ""): Record<string, string> {
  const record = z.record(z.string(), z.unknown()).parse(value);
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, child]) =>
      typeof child === "string"
        ? [[prefix + key, child]]
        : Object.entries(leaves(child, prefix + key + ".")),
    ),
  );
}

describe("Chinese language support", () => {
  it("defaults to Chinese while retaining explicit English and Italian selections", () => {
    expect(DEFAULT_LOCALE).toBe("zh-CN");
    expect(normalizeLocale()).toBe("zh-CN");
    expect(normalizeLocale("zh_CN")).toBe("zh-CN");
    expect(normalizeLocale("en-GB")).toBe("en-US");
    expect(normalizeLocale("it")).toBe("it-IT");
  });

  it("has complete translation keys and identical interpolation variables in both apps", () => {
    for (const [app, namespace] of [
      ["travel-map", "home"],
      ["travel-map", "error"],
      ["travel-map-editor", "editor"],
    ]) {
      const base = new URL(`../../../${app}/public/locales/`, import.meta.url);
      const english = leaves(
        JSON.parse(
          readFileSync(new URL(`en-US/${namespace}.json`, base), "utf8"),
        ),
      );
      for (const language of SUPPORTED_LOCALES) {
        const translated = leaves(
          JSON.parse(
            readFileSync(
              new URL(`${language}/${namespace}.json`, base),
              "utf8",
            ),
          ),
        );
        expect(Object.keys(translated).sort()).toEqual(
          Object.keys(english).sort(),
        );
        for (const [key, text] of Object.entries(english)) {
          expect(translated[key]?.trim(), `${language}:${key}`).toBeTruthy();
          expect(
            translated[key]?.match(/\{\{[^}]+\}\}/g)?.sort() ?? [],
            `${language}:${key}`,
          ).toEqual(text.match(/\{\{[^}]+\}\}/g)?.sort() ?? []);
        }
      }
    }
  });
});
