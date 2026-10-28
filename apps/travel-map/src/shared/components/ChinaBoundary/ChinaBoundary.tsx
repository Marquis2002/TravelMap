import type { ExpressionSpecification } from "maplibre-gl";
import { ReactNode } from "react";
import { Layer, Source } from "react-map-gl/maplibre";

import boundaryUrl from "../../../../public/maps/china-national.geojson?url";

/**
 * Shared coverage for the Chinese boundary dataset.
 * @property {string} border - Boundary line color
 * @property {ExpressionSpecification | string} fill - Opaque land color
 */
interface ChinaBoundaryProps {
  border: string;
  fill: ExpressionSpecification | string;
}

/**
 * ChinaBoundary component
 * Covers conflicting world-source lines before drawing the local Chinese outline.
 * @component
 * @param {ChinaBoundaryProps} props - Boundary appearance
 * @param {string} props.border - Boundary line color
 * @param {ExpressionSpecification | string} props.fill - Opaque land color
 * @returns {ReactNode} Shared national coverage and outline
 */
export function ChinaBoundary({ border, fill }: ChinaBoundaryProps): ReactNode {
  return (
    <Source data={boundaryUrl} id="china-national" type="geojson">
      <Layer
        id="china-national-fill"
        paint={{ "fill-color": fill }}
        type="fill"
      />
      <Layer
        id="china-national-border"
        paint={{ "line-color": border, "line-width": 1 }}
        type="line"
      />
    </Source>
  );
}
