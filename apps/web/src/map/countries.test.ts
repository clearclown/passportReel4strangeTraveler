import { describe, expect, test } from "vitest";
import type { Feature } from "geojson";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import topology from "world-atlas/countries-50m.json";
import { isVisited, toMapCountries } from "./countries";

const countries = toMapCountries(topology);

function findByName(name: string) {
  const country = countries.find((c) => c.feature.properties?.["name"] === name);
  if (!country) {
    throw new Error(`${name} が地図にない`);
  }
  return country;
}

describe("toMapCountries", () => {
  test("ISO 3166-1 numeric の id を alpha-2 に変換する", () => {
    expect(countries.find((c) => c.feature.id === "392")?.alpha2).toBe("JP");
  });

  test("idのないコソボは既存のXKへ対応づける", () => {
    expect(findByName("Kosovo").alpha2).toBe("XK");
  });
});

describe("海外領土の切り出し", () => {
  function polygonsOf(alpha2: string) {
    return countries
      .filter((c) => c.alpha2 === alpha2)
      .flatMap(({ feature: { geometry } }) => {
        if (geometry.type === "MultiPolygon") {
          return geometry.coordinates;
        }
        return geometry.type === "Polygon" ? [geometry.coordinates] : [];
      });
  }

  /** ポリゴンの外周がすべて指定の経緯度の範囲に収まるか。 */
  function within(
    polygon: number[][][],
    [west, south, east, north]: readonly [number, number, number, number],
  ) {
    return (polygon[0] ?? []).every(
      ([lon = Number.NaN, lat = Number.NaN]) =>
        lon >= west && lon <= east && lat >= south && lat <= north,
    );
  }

  test.each(["GF", "GP", "MQ", "YT", "RE", "SJ", "BQ"])(
    "%s の形状が親国から切り出される",
    (code) => {
      expect(polygonsOf(code).length).toBeGreaterThan(0);
    },
  );

  test.each([
    // フランス本土とコルシカ
    ["FR", [-6, 41, 10, 52]],
    // スヴァールバル諸島とヤンマイエン島を含まない本土と沿岸の島
    ["NO", [4, 57, 32, 72]],
    // カリブ海の島を含まない本土と沿岸の島
    ["NL", [3, 50, 8, 54]],
  ] as const)("%s の形状には本国の範囲だけが残る", (code, bounds) => {
    const polygons = polygonsOf(code);
    expect(polygons.length).toBeGreaterThan(0);
    expect(polygons.every((p) => within(p, bounds))).toBe(true);
  });
});

describe("北方四島の日本向け表示", () => {
  test.each([
    ["択捉島", [147.6, 45.05]],
    ["国後島", [145.95, 44.15]],
    ["色丹島", [146.75, 43.79]],
    ["歯舞群島・水晶島", [145.91, 43.44]],
    ["歯舞群島・志発島", [146.06, 43.43]],
    ["歯舞群島・多楽島", [146.31, 43.64]],
  ] as const)("%s の陸地はJPだけに含まれる", (_, point) => {
    const containing = countries.filter((country) => geoContains(country.feature, [...point]));
    expect(containing.map((country) => country.alpha2)).toEqual(["JP"]);
  });

  test.each([
    ["得撫島", [149.85, 45.9], "RU"],
    ["サハリン", [142.74, 46.96], "RU"],
    ["北海道", [143, 43], "JP"],
  ] as const)("%s の描画コードを維持する", (_, point, code) => {
    const containing = countries.filter((country) => geoContains(country.feature, [...point]));
    expect(containing.map((country) => country.alpha2)).toEqual([code]);
  });

  test("北方四島6形状の割り当てだけを変え、全ポリゴンを重複・欠落なく維持する", () => {
    const original = feature(topology, topology.objects.countries).features;
    const polygons = (features: readonly Feature[]) =>
      features.flatMap(({ geometry }) => {
        if (geometry.type === "MultiPolygon") {
          return geometry.coordinates;
        }
        return geometry.type === "Polygon" ? [geometry.coordinates] : [];
      });
    const originalCount = (id: string) =>
      polygons(original.filter((entry) => entry.id === id)).length;
    const mappedCount = (code: string) =>
      polygons(countries.filter((entry) => entry.alpha2 === code).map((entry) => entry.feature))
        .length;

    expect(mappedCount("RU")).toBe(originalCount("643") - 6);
    expect(mappedCount("JP")).toBe(originalCount("392") + 6);
    expect(
      polygons(countries.map((entry) => entry.feature))
        .map((p) => JSON.stringify(p))
        .toSorted(),
    ).toEqual(
      polygons(original)
        .map((p) => JSON.stringify(p))
        .toSorted(),
    );
  });
});

describe("isVisited", () => {
  const japan = findByName("Japan");
  const france = findByName("France");

  test("地図に対応しないコードが混在しても、対応する国は訪問済みと判定される", () => {
    const visited = new Set(["JP", "XK", "ZZ"]);
    expect(isVisited(japan, visited)).toBe(true);
    expect(isVisited(france, visited)).toBe(false);
  });

  test("alpha-2 を持たない形状は訪問済みと判定されない", () => {
    expect(isVisited(findByName("Siachen Glacier"), new Set(["XK"]))).toBe(false);
  });
});
