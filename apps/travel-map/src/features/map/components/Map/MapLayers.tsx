import { ReactNode, useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";

import { visitedCountries } from "@/data/world";
import { ChinaBoundary } from "@/shared/components/ChinaBoundary/ChinaBoundary";
import { useLanguage } from "@/shared/hooks/useLanguage";

import { countriesGeoJson } from "../../lib/countries";
import {
  CITY_LABEL_TIERS,
  cityLabelsGeoJson,
  countryLabelsGeoJson,
} from "../../lib/mapData";
import { createCountryFillColor, MapTheme } from "../../lib/mapTheme";
import { ChinaProvinceLayers } from "../ChinaProvinceLayers/ChinaProvinceLayers";

const LABEL_FONT = ["Urbanist SemiBold"];

/**
 * Properties accepted by the map label layers.
 * @property {MapTheme} theme - The active map theme
 */
interface MapLabelsProps {
  theme: MapTheme;
}

/**
 * Properties accepted by the map's geographic layers.
 * @property {boolean} showProvinces - Whether China's provincial overlay is shown
 * @property {MapTheme} theme - The active map theme
 */
interface MapLayersProps {
  showProvinces: boolean;
  theme: MapTheme;
}

/**
 * MapLabels component
 * Renders country and city label layers using the active map theme.
 * @component
 * @param {MapLabelsProps} props
 * @param {MapTheme} props.theme - The active map theme
 * @returns {ReactNode} The themed map label layers
 */
function MapLabels({ theme }: MapLabelsProps): ReactNode {
  const { currLanguage } = useLanguage(["home"]);
  return (
    <>
      <Source
        data={countryLabelsGeoJson}
        id="country-label-points"
        type="geojson"
      >
        <Layer
          filter={[
            "!",
            [
              "in",
              ["get", "name"],
              ["literal", ["Taiwan", "Macao", "Hong Kong"]],
            ],
          ]}
          id="country-labels"
          layout={{
            "text-field": [
              "upcase",
              ["coalesce", ["get", currLanguage], ["get", "name"]],
            ],
            "text-font": LABEL_FONT,
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1,
              9.45,
              6,
              12.6,
            ],
            "text-max-width": 9,
            "text-letter-spacing": 0.06,
          }}
          maxzoom={6.5}
          minzoom={1.1}
          paint={{
            "text-color": theme.countryLabel,
            "text-halo-color": theme.countryLabelHalo,
            "text-halo-width": 1,
            "text-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1,
              0.48,
              2.5,
              0.72,
            ],
          }}
          type="symbol"
        />
      </Source>

      <Source
        data={cityLabelsGeoJson(currLanguage)}
        id="city-label-points"
        type="geojson"
      >
        {CITY_LABEL_TIERS.map((tier) => (
          <Layer
            filter={
              [
                "all",
                [">=", ["get", "population"], tier.minPopulation],
                ...(Number.isFinite(tier.maxPopulation)
                  ? [["<", ["get", "population"], tier.maxPopulation]]
                  : []),
              ] as never
            }
            id={`city-labels-${tier.id}`}
            key={tier.id}
            layout={{
              "symbol-sort-key": ["-", ["get", "population"]],
              "text-anchor": "top",
              "text-field": ["get", "name"],
              "text-font": LABEL_FONT,
              "text-offset": [0, 0.6],
              "text-optional": true,
              "text-padding": 5,
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                2,
                11.03,
                7,
                13.65,
              ],
            }}
            minzoom={tier.minZoom}
            paint={{
              "text-color": theme.cityLabel,
              "text-halo-color": theme.cityLabelHalo,
              "text-halo-width": 1,
            }}
            type="symbol"
          />
        ))}
      </Source>
    </>
  );
}

/**
 * MapLayers component
 * Renders the country polygons, borders, and labels for the active map theme.
 * @component
 * @param {MapLayersProps} props
 * @param {boolean} props.showProvinces - Whether China's provincial overlay is shown
 * @param {MapTheme} props.theme - The active map theme
 * @returns {ReactNode} The themed geographic map layers
 */
export function MapLayers({ showProvinces, theme }: MapLayersProps): ReactNode {
  const countryFillColor = useMemo(
    () => createCountryFillColor(visitedCountries, theme.land),
    [theme.land],
  );

  return (
    <>
      <Source data={countriesGeoJson} id="countries" type="geojson">
        <Layer
          id="country-fill"
          paint={{ "fill-color": countryFillColor }}
          type="fill"
        />
        <Layer
          filter={[
            "!",
            [
              "in",
              ["get", "name"],
              ["literal", ["China", "Taiwan", "Hong Kong", "Macao"]],
            ],
          ]}
          id="country-border"
          paint={{
            "line-color": theme.border,
            "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 6, 1],
            "line-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1,
              0.35,
              4,
              1,
            ],
          }}
          type="line"
        />
      </Source>

      <ChinaBoundary
        border={theme.border}
        fill={createCountryFillColor(
          visitedCountries
            .filter((country) => country.name === "China")
            .map((country) => ({
              name: "中华人民共和国",
              fillColor: country.fillColor,
            })),
          theme.land,
        )}
      />
      <ChinaProvinceLayers theme={theme} visible={showProvinces} />
      <MapLabels theme={theme} />
    </>
  );
}
