import "./ProvinceCoverageCard.scss";

import { ReactNode } from "react";
import useSWR from "swr";

import { visitedCities } from "@/data/world";
import { useLanguage } from "@/shared/hooks/useLanguage";
import { classNames } from "@/shared/lib/classNames";

import { coveredProvinces, loadProvinces } from "../../../lib/provinces";
import { Card } from "../../Card/Card";

/**
 * ProvinceCoverageCard component
 * Uses the continent card's visited-place scope with the map's 34 provincial regions.
 * @component
 * @returns {ReactNode} Provincial coverage score and visited-status badges
 */
export function ProvinceCoverageCard(): ReactNode {
  const { t } = useLanguage(["home"]);
  const { data, error } = useSWR(
    `${import.meta.env.BASE_URL}maps/china-provinces.geojson`,
    loadProvinces,
  );
  const covered = coveredProvinces(
    visitedCities.map((city) => city.coordinates),
    data ?? [],
  );
  return (
    <Card className="bento-card bento-card--medium bento-detail province-coverage card--box-shadow">
      <div className="province-coverage__header">
        <h2>{t("stats.provinces.title")}</h2>
        <div className="province-coverage__score">
          <b>{data ? covered.size : "—"}</b>
          <span>/ 34</span>
        </div>
      </div>
      {data ? (
        <>
          <progress
            aria-label={t("stats.provinces.title")}
            className="province-coverage__progress"
            max={34}
            value={covered.size}
          />
          <ul className="province-coverage__regions">
            {data.map((province) => (
              <li
                className={classNames(
                  "province-coverage__region",
                  covered.has(province.code) &&
                    "province-coverage__region--visited",
                )}
                key={province.code}
              >
                <span aria-hidden="true">
                  {covered.has(province.code) ? "●" : "○"}
                </span>
                {province.name.replace(
                  /(壮族|回族|维吾尔)?自治区|特别行政区|省|市/g,
                  "",
                )}
                <span className="province-coverage__status">
                  {t(
                    covered.has(province.code)
                      ? "stats.provinces.visited"
                      : "stats.provinces.unvisited",
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p role="status">
          {t(error ? "stats.provinces.failed" : "stats.provinces.loading")}
        </p>
      )}
    </Card>
  );
}
