import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const regions = read("docs/region-catalog/regions.json").entries;
const points = new Map(
  read("docs/region-catalog/map-locations.json").entries.map((entry) => [entry.id, entry]),
);
const output = "apps/web/src/regions/destinations.json";

function kind(tags) {
  if (
    tags.some((tag) =>
      ["cultural-community", "symbolic-republic", "micronation-claim"].includes(tag),
    )
  )
    return "共同体";
  if (tags.includes("self-governing-community")) return "自治共同体";
  if (tags.some((tag) => tag.startsWith("indigenous-"))) return "先住民領域";
  if (tags.some((tag) => ["de-facto-entity-candidate", "disputed-status-candidate"].includes(tag)))
    return "地域";
  return tags.some((tag) =>
    [
      "special-autonomy",
      "autonomous-community",
      "autonomous-city",
      "autonomous-province",
      "provincial-autonomous-region",
      "regional-self-government",
      "republic-with-special-status",
    ].includes(tag),
  )
    ? "自治地域"
    : "地域";
}

// 採用と制度の確認状況を分ける。歴史上の統治体は現在の訪問先へ自動で変換しない。
const entries = regions
  .filter(
    (entry) =>
      entry.origin === "research-candidate" &&
      entry.decision.status === "accepted" &&
      entry.temporal.status !== "historical-candidate",
  )
  .map((entry) => {
    const point = points.get(entry.id);
    if (
      entry.applicationCode !== entry.id ||
      !point ||
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude) ||
      Math.abs(point.latitude) > 90 ||
      Math.abs(point.longitude) > 180
    ) {
      throw new Error(`訪問先の識別子・代表地点を確認してください: ${entry.id}`);
    }
    return {
      code: entry.id,
      name: entry.nameJa,
      originalName: entry.nameOriginal,
      aliases: entry.aliases,
      kind: kind(entry.tags),
      point: { longitude: point.longitude, latitude: point.latitude, sourceUrl: point.sourceUrl },
    };
  });
if (new Set(entries.map((entry) => entry.code)).size !== entries.length)
  throw new Error("訪問先のIDが重複しています");

// 通常のformatterと同じ出力にし、--checkでは原本からの生成漏れだけを検出する。
function generate(path, content) {
  const formatted = spawnSync("pnpm", ["exec", "oxfmt", "--stdin-filepath", path], {
    cwd: root,
    input: content,
    encoding: "utf8",
  });
  if (formatted.status !== 0) throw new Error(formatted.stderr || "生成データの整形に失敗しました");
  const target = resolve(root, path);
  if (process.argv.includes("--check")) {
    if (!existsSync(target) || readFileSync(target, "utf8") !== formatted.stdout)
      throw new Error("生成データが古いため、pnpm generate:destinationsを実行してください");
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, formatted.stdout);
  }
}
generate(output, JSON.stringify(entries, null, 2));
const fallbacks = regions
  .filter((entry) => entry.origin === "existing-app" && points.has(entry.id))
  .map((entry) => {
    const point = points.get(entry.id);
    return {
      code: entry.applicationCode,
      name: entry.nameJa,
      point: { longitude: point.longitude, latitude: point.latitude, sourceUrl: point.sourceUrl },
    };
  });
generate("apps/web/src/regions/mapFallbacks.json", JSON.stringify(fallbacks, null, 2));

const boundary = read("docs/region-catalog/geometry/republika-srpska.geojson");
if (boundary.geometry.type !== "MultiPolygon")
  throw new Error("スルプスカ共和国の境界形式が異なります");
// d3-geoは半球より小さい外周を時計回りで扱うため、GeoJSONの向きから変換する。
const coordinates = boundary.geometry.coordinates.map((polygon) =>
  polygon.map((ring, index) => {
    const signedArea = ring.reduce((sum, point, i) => {
      const next = ring[(i + 1) % ring.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0);
    return (index === 0 ? signedArea > 0 : signedArea < 0) ? ring.toReversed() : ring;
  }),
);
generate(
  "apps/web/src/map/regionGeometry.ts",
  'import type { Feature, MultiPolygon } from "geojson";\n\n/** geoBoundariesの固定版（2013年対象）から生成。原本はdocs/region-catalog/geometry、更新はpnpm generate:destinations。 */\nexport const srpskaGeometry: Feature<MultiPolygon> = ' +
    JSON.stringify({
      type: "Feature",
      properties: { name: "Republika Srpska" },
      geometry: { type: "MultiPolygon", coordinates },
    }) +
    ";\n",
);
console.log(
  `訪問先データ ${entries.length}件: ${process.argv.includes("--check") ? "一致" : "生成済み"}`,
);
