import { describe, expect, test } from "vitest";
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
