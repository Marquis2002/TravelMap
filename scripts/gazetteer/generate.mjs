import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const require = createRequire(
  new URL("../../apps/travel-map-editor/package.json", import.meta.url),
);
const world = require("all-the-cities");
const source = resolve(process.argv[2] ?? ".local-runtime/gazetteer-source");
const output = resolve("apps/travel-map-editor/vite/data");
const hashes = {
  "ok_data_level3.csv":
    "dd5a1594565b65fa3fea5ce4b9935e0b28908226949ae44f07ebfd533428e8ff",
  "ok_geo.csv":
    "ac2641b1cb137d099779f49b21b965919591af9d82a29a911f6270530fef8ed7",
};

/**
 * Parses quoted CSV fields, stopping before the unused, very large polygon column.
 * @param {string} line - One physical CSV row; this source has no multiline fields
 * @param {number} limit - Number of columns to retain
 * @returns {string[]} Unescaped fields
 */
function fields(line, limit) {
  const result = [];
  let quoted = false;
  let value = "";
  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];
    if (character === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      result.push(value);
      if (result.length === limit) return result;
      value = "";
    } else value += character;
  }
  result.push(value);
  return result;
}

/**
 * Reads only verified source files so an upstream update cannot silently change the index.
 * @param {string} file - Pinned source filename
 * @param {number} limit - Columns retained per row
 * @returns {Promise<string[][]>} Parsed rows without the header
 */
async function rows(file, limit) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(resolve(source, file)))
    digest.update(chunk);
  if (digest.digest("hex") !== hashes[file])
    throw new Error(`Source checksum mismatch: ${file}`);
  const records = [];
  for await (const line of createInterface({
    input: createReadStream(resolve(source, file)),
    crlfDelay: Infinity,
  })) {
    if (!line.trim()) continue;
    records.push(fields(line.replace(/^\uFEFF/, ""), limit));
  }
  return records.slice(1);
}

/**
 * Computes the conventional GCJ-02 offset using the Krasovsky ellipsoid.
 * @param {number} longitude - WGS84 longitude estimate
 * @param {number} latitude - WGS84 latitude estimate
 * @returns {number[]} Angular offset in longitude, latitude order
 */
function offset(longitude, latitude) {
  const x = longitude - 105;
  const y = latitude - 35;
  const pi = Math.PI;
  const common =
    ((20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2) / 3;
  let lat =
    -100 +
    2 * x +
    3 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x)) +
    common;
  lat += ((20 * Math.sin(y * pi) + 40 * Math.sin((y * pi) / 3)) * 2) / 3;
  lat +=
    ((160 * Math.sin((y * pi) / 12) + 320 * Math.sin((y * pi) / 30)) * 2) / 3;
  let lng =
    300 +
    x +
    2 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x)) +
    common;
  lng += ((20 * Math.sin(x * pi) + 40 * Math.sin((x * pi) / 3)) * 2) / 3;
  lng +=
    ((150 * Math.sin((x * pi) / 12) + 300 * Math.sin((x * pi) / 30)) * 2) / 3;
  const rad = (latitude * pi) / 180;
  const magic = 1 - 0.00669342162296594323 * Math.sin(rad) ** 2;
  return [
    (lng * 180) / ((6378245 / Math.sqrt(magic)) * Math.cos(rad) * pi),
    (lat * 180) /
      (((6378245 * (1 - 0.00669342162296594323)) / (magic * Math.sqrt(magic))) *
        pi),
  ];
}

/**
 * Inverts GCJ-02 iteratively; the source is an approximate place point, not survey data.
 * @param {number[]} point - Source GCJ-02 longitude and latitude
 * @returns {number[]} WGS84 point rounded to six decimal places
 */
function wgs84(point) {
  let estimate = [...point];
  for (let i = 0; i < 5; i += 1) {
    const delta = offset(...estimate);
    estimate = point.map((coordinate, axis) => coordinate - delta[axis]);
  }
  return estimate.map((value) => Number(value.toFixed(6)));
}

const names = await rows("ok_data_level3.csv", 8);
const positions = new Map(
  (await rows("ok_geo.csv", 6)).map((row) => [row[0], row]),
);
const nodes = new Map(
  names.map(([id, pid, deep, name, prefix, pinyin, extId, full]) => [
    id,
    { id, pid, deep: Number(deep), name, pinyin, extId, full },
  ]),
);
const municipalities = new Set(["11", "12", "31", "50"]);
const excluded = [];
const missing = [];
const index = [];
for (const node of nodes.values()) {
  if (node.pid !== "0" && !nodes.has(node.pid))
    throw new Error(`Missing parent: ${node.id}`);
  let province = node;
  while (province.pid !== "0") province = nodes.get(province.pid);
  if (["71", "81", "82"].includes(province.id)) continue;
  const parent = nodes.get(node.pid);
  if (node.deep === 0 && !municipalities.has(node.id)) continue;
  if (
    (node.deep === 1 && municipalities.has(province.id)) ||
    (parent && node.extId === parent.extId && node.full === parent.full)
  ) {
    excluded.push({ id: node.id, name: node.full, parent: node.pid });
    continue;
  }
  const geo = positions.get(node.id);
  if (!geo || geo[5] === "EMPTY") {
    missing.push({ id: node.id, name: node.full });
    continue;
  }
  const point = geo[5].split(" ").map(Number);
  if (
    point.length !== 2 ||
    !point.every(Number.isFinite) ||
    point[0] < 73 ||
    point[0] > 136 ||
    point[1] < 3 ||
    point[1] > 54
  )
    throw new Error(`Invalid coordinate: ${node.id}`);
  const coordinates = wgs84(point);
  const name = node.pinyin
    .split(" ")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join("");
  const level =
    node.deep === 0
      ? "city"
      : node.deep === 1 && node.id.length === 4
        ? "city"
        : "county";
  const suffix = node.full.endsWith("市")
    ? "shi"
    : node.full.endsWith("区")
      ? "qu"
      : node.full.endsWith("县")
        ? "xian"
        : "";
  index.push({
    key: `areacity:${node.id}`,
    gazetteerKey: `areacity:${node.id}`,
    countryCode: "CN",
    name,
    nameByLocale: { "zh-CN": node.full },
    aliases: [
      node.name,
      node.full,
      node.pinyin,
      `${node.pinyin} ${suffix}`.trim(),
    ],
    adminLevel: level,
    province: province.full,
    prefecture:
      node.deep === 2 && !municipalities.has(province.id)
        ? parent.full
        : undefined,
    regionAliases: [
      province.name,
      province.pinyin,
      ...(node.deep === 2 && !municipalities.has(province.id)
        ? [parent.name, parent.pinyin]
        : []),
    ],
    coordinates,
    timeZone: "Asia/Shanghai",
  });
}

/* Only these reviewed identities are merged with the legacy world source. */
const reviewed = {
  "areacity:4401": 1809858,
  "areacity:4602": 1796556,
  "areacity:11": 1816670,
  "areacity:6101": 1790630,
};
for (const entry of index) {
  const city = world.find((city) => city.cityId === reviewed[entry.key]);
  if (!city) continue;
  if (
    city.country !== "CN" ||
    Math.abs(city.loc.coordinates[0] - entry.coordinates[0]) > 0.5 ||
    Math.abs(city.loc.coordinates[1] - entry.coordinates[1]) > 0.5
  )
    throw new Error(`Reviewed identity needs correction: ${entry.key}`);
  entry.aliases.push(city.name);
  entry.name = city.name;
  entry.legacyKeys = [String(city.cityId)];
  if (city.population > 0) entry.population = city.population;
}
const extras = [
  [1819729, "香港", "xiang gang", ["Hong Kong", "Hongkong"]],
  [1821274, "澳门", "ao men", ["Macao", "Macau"]],
  [1668341, "台北", "tai bei", ["Taipei", "台北市"]],
  [6696918, "桃园", "tao yuan", ["Taoyuan", "桃园市"]],
  [1668399, "台中", "tai zhong", ["Taichung", "台中市"]],
  [1668355, "台南", "tai nan", ["Tainan", "台南市"]],
  [1673820, "高雄", "gao xiong", ["Kaohsiung", "高雄市"]],
  [1678228, "基隆", "ji long", ["Keelung", "基隆市"]],
  [1675151, "新竹", "xin zhu", ["Hsinchu", "新竹市"]],
  [1678836, "嘉义", "jia yi", ["Chiayi", "嘉义市"]],
  [1674504, "花莲", "hua lian", ["Hualien", "花莲市"]],
  [6949678, "台东", "tai dong", ["Taitung", "台东市"]],
];
for (const [id, chinese, pinyin, aliases] of extras) {
  const city = world.find((city) => city.cityId === id);
  if (!city) throw new Error(`Missing pinned GeoNames place ${id}`);
  index.push({
    key: `geonames:${id}`,
    gazetteerKey: `geonames:${id}`,
    legacyKeys: [String(id)],
    countryCode: city.country,
    name: city.name,
    nameByLocale: { "zh-CN": chinese },
    aliases: [chinese, pinyin, ...aliases],
    adminLevel: "city",
    province: city.country === "TW" ? "台湾省" : chinese,
    regionAliases: city.country === "TW" ? ["台湾", "tai wan", "Taiwan"] : [],
    coordinates: city.loc.coordinates,
    timeZone:
      city.country === "HK"
        ? "Asia/Hong_Kong"
        : city.country === "MO"
          ? "Asia/Macau"
          : "Asia/Taipei",
    ...(city.population > 0 ? { population: city.population } : {}),
  });
}
index.push({
  key: "geonames:12908892",
  gazetteerKey: "geonames:12908892",
  countryCode: "TW",
  name: "New Taipei",
  nameByLocale: { "zh-CN": "新北" },
  aliases: ["新北", "新北市", "xin bei", "New Taipei City"],
  adminLevel: "city",
  province: "台湾省",
  regionAliases: ["台湾", "tai wan", "Taiwan"],
  coordinates: [121.45703, 25.06199],
  timeZone: "Asia/Taipei",
});
if (new Set(index.map((entry) => entry.key)).size !== index.length)
  throw new Error("Duplicate source keys");
const report = {
  version: "2025.251231.260403",
  sourceHashes: hashes,
  mainland: index.filter((entry) => entry.countryCode === "CN").length,
  majorHkMoTw: 13,
  byProvince: Object.fromEntries(
    [
      ...new Set(
        index
          .filter((entry) => entry.countryCode === "CN")
          .map((entry) => entry.province),
      ),
    ].map((province) => [
      province,
      index.filter((entry) => entry.province === province).length,
    ]),
  ),
  removedFillers: excluded,
  missingCoordinates: missing,
  knownSourceOmissions: ["新疆和康县", "新疆和安县"],
  reviewedWorldMerges: reviewed,
};
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(output, "chinaPlaces.json"),
  JSON.stringify(index) + "\n",
);
writeFileSync(
  resolve(output, "chinaPlaces.report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    mainland: report.mainland,
    majorHkMoTw: 13,
    removedFillers: excluded.length,
    missingCoordinates: missing.length,
  }),
);
