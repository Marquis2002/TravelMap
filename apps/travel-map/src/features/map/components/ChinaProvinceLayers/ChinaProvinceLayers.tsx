import { ReactNode } from "react";
import { Layer, Source } from "react-map-gl/maplibre";

import { MapTheme } from "../../lib/mapTheme";

/**
 * Appearance and visibility of the locally hosted provincial boundaries.
 * @property {MapTheme} theme - Colors matching the current world map
 * @property {boolean} visible - Whether the provincial overlay is enabled
 */
interface ChinaProvinceLayersProps {
  theme: MapTheme;
  visible: boolean;
}

/**
 * ChinaProvinceLayers component
 * Adds provincial boundaries and one Chinese label per region without changing
 * the trip dataset or loading boundary coordinates into the JavaScript bundle.
 * @component
 * @param {ChinaProvinceLayersProps} props - Provincial layer options
 * @param {MapTheme} props.theme - Colors matching the current world map
 * @param {boolean} props.visible - Whether the provincial overlay is enabled
 * @returns {ReactNode} Local GeoJSON sources and themed map layers
 */
export function ChinaProvinceLayers({
  theme,
  visible,
}: ChinaProvinceLayersProps): ReactNode {
  const visibility = visible ? "visible" : "none";

  return (
    <>
      <Source
        data={`${import.meta.env.BASE_URL}maps/china-provinces.geojson`}
        id="china-provinces"
        type="geojson"
      >
        <Layer
          id="china-province-borders"
          layout={{ visibility }}
          minzoom={1.5}
          paint={{
            "line-color": theme.countryLabel,
            "line-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              2,
              0.2,
              4,
              0.7,
            ],
            "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.5, 7, 1.4],
          }}
          type="line"
        />
      </Source>
      <Source
        data={`${import.meta.env.BASE_URL}maps/china-province-labels.geojson`}
        id="china-province-label-points"
        type="geojson"
      >
        <Layer
          id="china-province-labels"
          layout={{
            "text-field": [
              "step",
              ["zoom"],
              ["get", "label"],
              5,
              ["get", "name"],
            ],
            "text-font": ["Urbanist SemiBold"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 2.5, 11, 6, 15],
            "text-max-width": 8,
            "text-padding": 4,
            "text-variable-anchor": [
              "center",
              "top",
              "bottom",
              "left",
              "right",
            ],
            visibility,
          }}
          minzoom={1.8}
          paint={{
            "text-color": theme.cityLabel,
            "text-halo-color": theme.cityLabelHalo,
            "text-halo-width": 1.5,
          }}
          type="symbol"
        />
      </Source>
    </>
  );
}
