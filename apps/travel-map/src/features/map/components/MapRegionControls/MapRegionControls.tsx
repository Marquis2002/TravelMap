import "./MapRegionControls.scss";

import { ReactNode } from "react";
import { useMap } from "react-map-gl/maplibre";

import { usePanel } from "@/shared/context/Panel.context";
import { useLanguage } from "@/shared/hooks/useLanguage";

import { CAMERA_DURATION_MS, getCameraPadding } from "../../lib/mapCamera";

/**
 * Controls for the provincial overlay and regional camera shortcuts.
 * @property {boolean} showProvinces - Whether provincial boundaries are visible
 * @property {(visible: boolean) => void} onShowProvinces - Changes overlay visibility
 */
interface MapRegionControlsProps {
  showProvinces: boolean;
  onShowProvinces: (visible: boolean) => void;
}

/**
 * MapRegionControls component
 * Provides China and world framing with a provincial overlay switch on desktop
 * and touch screens, keeping camera bounds clear of the trip panel.
 * @component
 * @param {MapRegionControlsProps} props - Overlay controls
 * @param {boolean} props.showProvinces - Whether provincial boundaries are visible
 * @param {(visible: boolean) => void} props.onShowProvinces - Changes overlay visibility
 * @returns {ReactNode} Regional map controls and source attribution
 */
export function MapRegionControls({
  showProvinces,
  onShowProvinces,
}: MapRegionControlsProps): ReactNode {
  const { current: map } = useMap();
  const { isPanelOpen } = usePanel();
  const { t } = useLanguage(["home"]);

  /**
   * Frames the provincial map, including the southern island features.
   * @returns {void}
   */
  function handleChina(): void {
    if (!map) return;
    onShowProvinces(true);
    map.fitBounds(
      [
        [73, 3],
        [136, 54],
      ],
      {
        padding: getCameraPadding(map.getCanvas().clientWidth, isPanelOpen),
        duration: CAMERA_DURATION_MS,
        maxZoom: 5,
      },
    );
  }

  /**
   * Returns to a world overview without changing any authored trip view.
   * @returns {void}
   */
  function handleWorld(): void {
    if (!map) return;
    map.fitBounds(
      [
        [-179, -60],
        [179, 80],
      ],
      {
        padding: getCameraPadding(map.getCanvas().clientWidth, isPanelOpen),
        duration: CAMERA_DURATION_MS,
      },
    );
  }

  return (
    <section aria-label={t("map.regions")} className="map-region-controls">
      <div className="map-region-controls__actions">
        <button aria-label={t("map.china")} onClick={handleChina} type="button">
          {t("map.china")}
        </button>
        <button aria-label={t("map.world")} onClick={handleWorld} type="button">
          {t("map.world")}
        </button>
        <label className="map-region-controls__toggle">
          <input
            checked={showProvinces}
            onChange={(event) => onShowProvinces(event.target.checked)}
            type="checkbox"
          />
          {t("map.provinces")}
        </label>
      </div>
      <a
        className="map-region-controls__source"
        href="https://datav.aliyun.com/portal/school/atlas/area_selector"
        rel="noreferrer"
        target="_blank"
      >
        {t("map.provinceSource")}
      </a>
    </section>
  );
}
