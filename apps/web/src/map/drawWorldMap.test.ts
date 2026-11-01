import { describe, expect, test } from "vitest";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import topology from "world-atlas/countries-50m.json";
import { toMapCountries } from "./countries";
import {
  drawEmphasizedCountries,
  drawWorldMap,
  type EmphasisContext,
  MAP_ASPECT_RATIO,
  MAP_COLORS,
  type MapContext,
  mapExtent,
  planWorldMap,
} from "./drawWorldMap";

const countries = toMapCountries(topology);
const size = { width: 1000, height: 1000 / MAP_ASPECT_RATIO };
const northernTerritoriesPoints: readonly [number, number][] = [
  [147.6, 45.05],
  [145.95, 44.15],
  [146.75, 43.79],
  [145.91, 43.44],
  [146.06, 43.43],
  [146.31, 43.64],
];

function markerOf(plan: ReturnType<typeof planWorldMap>, alpha2: string) {
  const marker = plan.markers.find((m) => m.alpha2 === alpha2);
  if (!marker) {
    throw new Error(`${alpha2} のマーカーがない`);
  }
  return marker;
}

function colorOf(plan: ReturnType<typeof planWorldMap>, alpha2: string) {
  return plan.fills.find((f) => f.country.alpha2 === alpha2)?.color;
}

/** fill/arc の呼び出しをその時点の fillStyle とともに記録するフェイクのコンテキスト。 */
function createRecordingContext() {
  const fills: MapContext["fillStyle"][] = [];
  const arcs: { x: number; y: number }[] = [];
  const pathCommands: number[][] = [];
  const ctx: MapContext = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: () => {},
    beginPath: () => {
      pathCommands.push([0]);
    },
    moveTo: (x, y) => {
      pathCommands.push([1, x, y]);
    },
    lineTo: (x, y) => {
      pathCommands.push([2, x, y]);
    },
    closePath: () => {
      pathCommands.push([3]);
    },
    stroke: () => {},
    arc: (x, y) => {
      arcs.push({ x, y });
    },
    fill: () => {
      fills.push(ctx.fillStyle);
    },
  };
  return { ctx, fills, arcs, pathCommands };
}

describe("planWorldMap", () => {
  test.each([
    { label: "訪問なし", visited: [], expected: MAP_COLORS.unvisited },
    { label: "ロシアのみ", visited: ["RU"], expected: MAP_COLORS.unvisited },
    { label: "日本のみ", visited: ["JP"], expected: MAP_COLORS.visited },
    { label: "日本とロシア", visited: ["JP", "RU"], expected: MAP_COLORS.visited },
  ])("$label の場合も北方四島は日本の訪問状態で塗る", ({ visited, expected }) => {
    const plan = planWorldMap(size, countries, new Set(visited));
    for (const point of northernTerritoriesPoints) {
      const covering = plan.fills.filter(({ country }) => geoContains(country.feature, point));
      expect(covering.map(({ color }) => color)).toEqual([expected]);
    }
    expect(colorOf(plan, "RU")).toBe(
      visited.includes("RU") ? MAP_COLORS.visited : MAP_COLORS.unvisited,
    );
    expect(plan.markers).toHaveLength(0);
  });

  test("訪問国はハイライト色、それ以外は未訪問色で塗られる", () => {
    const plan = planWorldMap(size, countries, new Set(["JP", "FR"]));
    expect(colorOf(plan, "JP")).toBe(MAP_COLORS.visited);
    expect(colorOf(plan, "FR")).toBe(MAP_COLORS.visited);
    expect(colorOf(plan, "US")).toBe(MAP_COLORS.unvisited);
  });

  test("訪問国が空ならすべて未訪問色で塗られる", () => {
    const plan = planWorldMap(size, countries, new Set());
    expect(plan.fills.every((f) => f.color === MAP_COLORS.unvisited)).toBe(true);
    expect(plan.markers).toHaveLength(0);
  });

  test("小さな訪問国にはマーカーが出て、大きな訪問国には出ない", () => {
    const plan = planWorldMap(size, countries, new Set(["SG", "FR"]));
    expect(plan.markers.map((m) => m.alpha2)).toEqual(["SG"]);
  });

  test("大きな国に属する小さな離島の形状にはマーカーが出ない（AU とアシュモア・カルティエ諸島）", () => {
    const plan = planWorldMap(size, countries, new Set(["AU"]));
    expect(plan.markers).toHaveLength(0);
  });

  test("南極は表示範囲の端で切られても、訪問済みならハイライトされマーカーは出ない", () => {
    const plan = planWorldMap(size, countries, new Set(["AQ"]));
    expect(colorOf(plan, "AQ")).toBe(MAP_COLORS.visited);
    expect(plan.markers).toHaveLength(0);
  });

  test("未訪問の小さな国にはマーカーが出ない", () => {
    const plan = planWorldMap(size, countries, new Set(["FR"]));
    expect(plan.markers.find((m) => m.alpha2 === "SG")).toBeUndefined();
  });

  test("マーカーは国の位置に置かれる（シンガポールは日本より西・南）", () => {
    const plan = planWorldMap(size, countries, new Set(["SG", "VA"]));
    const sg = markerOf(plan, "SG");
    const va = markerOf(plan, "VA");
    // バチカン（ヨーロッパ）はシンガポールより西かつ北にある
    expect(va.x).toBeLessThan(sg.x);
    expect(va.y).toBeLessThan(sg.y);
  });

  test("親国を登録しても、親国の形状に含まれていた海外領土は塗られない", () => {
    const plan = planWorldMap(size, countries, new Set(["FR", "NO", "NL"]));
    for (const territory of ["GF", "GP", "MQ", "YT", "RE", "SJ", "BQ"]) {
      expect(colorOf(plan, territory)).toBe(MAP_COLORS.unvisited);
    }
    expect(plan.markers).toHaveLength(0);
  });

  test("海外領土を登録すると、その地域だけが塗られる", () => {
    const plan = planWorldMap(size, countries, new Set(["GF", "SJ", "BQ"]));
    for (const territory of ["GF", "SJ", "BQ"]) {
      expect(colorOf(plan, territory)).toBe(MAP_COLORS.visited);
    }
    for (const parent of ["FR", "NO", "NL"]) {
      expect(colorOf(plan, parent)).toBe(MAP_COLORS.unvisited);
    }
  });

  test("小さな海外領土にはマーカーが出る（グアドループはマルティニークより北）", () => {
    const plan = planWorldMap(size, countries, new Set(["GP", "MQ"]));
    expect(markerOf(plan, "GP").y).toBeLessThan(markerOf(plan, "MQ").y);
  });

  test("地図に対応しないコードが混在しても、対応する国はハイライトされる", () => {
    const plan = planWorldMap(size, countries, new Set(["JP", "XK", "ZZ"]));
    expect(colorOf(plan, "JP")).toBe(MAP_COLORS.visited);
  });
});

describe("drawWorldMap", () => {
  test("計画どおりの色で各国を塗り、小さな訪問国にマーカーを描く", () => {
    const visited = new Set(["JP", "SG"]);
    const plan = planWorldMap(size, countries, visited);
    const { ctx, fills, arcs } = createRecordingContext();

    drawWorldMap(ctx, size, countries, visited);

    // 各国 → マーカーの順に塗られる（海は fillRect で全面を塗る）
    expect(fills).toEqual([
      ...plan.fills.map((f) => f.color),
      ...plan.markers.map(() => MAP_COLORS.marker),
    ]);
    // マーカーは外側の輪と中心の点の2つの円で描く
    const sg = markerOf(plan, "SG");
    expect(arcs).toEqual([
      { x: sg.x, y: sg.y },
      { x: sg.x, y: sg.y },
    ]);
  });
});

/** fill の呼び出しを、その時点の塗り色と光彩の強さとともに記録するフェイクのコンテキスト。 */
function createEmphasisRecordingContext() {
  const { ctx: base, arcs, pathCommands } = createRecordingContext();
  const fills: { color: EmphasisContext["fillStyle"]; blur: number }[] = [];
  const ctx: EmphasisContext = {
    ...base,
    shadowBlur: 0,
    shadowColor: "",
    save: () => {},
    restore: () => {},
    fill: () => {
      fills.push({ color: ctx.fillStyle, blur: ctx.shadowBlur });
    },
  };
  return { ctx, fills, arcs, pathCommands };
}

describe("drawEmphasizedCountries", () => {
  const featureCount = (alpha2: string) => countries.filter((c) => c.alpha2 === alpha2).length;

  test("ロシアの強調描画は北方四島6形状を除いた輪郭だけを描く", () => {
    const originalRussia = feature(topology, topology.objects.countries).features.find(
      (entry) => entry.id === "643",
    );
    if (originalRussia?.geometry.type !== "MultiPolygon") {
      throw new Error("元データにロシアのMultiPolygonがない");
    }
    // 実装の矩形範囲を参照せず、各島の陸上地点を含むポリゴンを期待値から除く。
    const coordinates = originalRussia.geometry.coordinates.filter(
      (polygon) =>
        !northernTerritoriesPoints.some((point) =>
          geoContains({ type: "Polygon", coordinates: polygon }, point),
        ),
    );
    const actual = createEmphasisRecordingContext();
    const expected = createEmphasisRecordingContext();
    drawEmphasizedCountries(actual.ctx, size, countries, new Set(["RU"]), 1);
    drawEmphasizedCountries(
      expected.ctx,
      size,
      [
        {
          alpha2: "RU",
          feature: { ...originalRussia, geometry: { type: "MultiPolygon", coordinates } },
        },
      ],
      new Set(["RU"]),
      1,
    );

    expect(actual.pathCommands).toEqual(expected.pathCommands);
    expect(actual.fills).toEqual(expected.fills);
    expect(actual.arcs).toEqual([]);
  });

  test("指定した国だけを強調色で塗り、強さに応じて光彩を付ける", () => {
    const { ctx, fills } = createEmphasisRecordingContext();
    drawEmphasizedCountries(ctx, size, countries, new Set(["FR"]), 1);
    expect(fills).toHaveLength(featureCount("FR"));
    expect(fills.every((f) => f.color === "rgb(255, 210, 122)" && f.blur > 0)).toBe(true);
  });

  test("強さ 0 ではハイライト色のままで光彩がない", () => {
    const { ctx, fills } = createEmphasisRecordingContext();
    drawEmphasizedCountries(ctx, size, countries, new Set(["FR"]), 0);
    expect(fills.every((f) => f.color === "rgb(242, 169, 59)" && f.blur === 0)).toBe(true);
  });

  test("小さな国には強調色のマーカーを描く", () => {
    const { ctx, fills, arcs } = createEmphasisRecordingContext();
    drawEmphasizedCountries(ctx, size, countries, new Set(["SG"]), 1);
    const sg = markerOf(planWorldMap(size, countries, new Set(["SG"])), "SG");
    expect(arcs).toEqual([{ x: sg.x, y: sg.y }]);
    expect(fills.at(-1)?.color).toBe("rgb(255, 210, 122)");
  });

  test("国の指定がなければ何も描かない", () => {
    const { ctx, fills } = createEmphasisRecordingContext();
    drawEmphasizedCountries(ctx, size, countries, new Set(), 1);
    expect(fills).toHaveLength(0);
  });
});

describe("mapExtent", () => {
  test("横長の領域では高さいっぱいに収め、左右中央に置く", () => {
    const [[x0, y0], [x1, y1]] = mapExtent({ width: 2000, height: 500 });
    expect(y0).toBeCloseTo(0);
    expect(y1).toBeCloseTo(500);
    expect(x1 - x0).toBeCloseTo(500 * MAP_ASPECT_RATIO);
    expect(x0).toBeCloseTo(2000 - x1);
  });

  test("縦長の領域では幅いっぱいに収め、上下中央に置く", () => {
    const [[x0, y0], [x1, y1]] = mapExtent({ width: 375, height: 700 });
    expect(x0).toBeCloseTo(0);
    expect(x1).toBeCloseTo(375);
    expect(y1 - y0).toBeCloseTo(375 / MAP_ASPECT_RATIO);
    expect(y0).toBeCloseTo(700 - y1);
  });

  test("縦長の領域でも国は地図の範囲内に描かれる", () => {
    const tall = { width: 375, height: 700 };
    const [[, y0], [, y1]] = mapExtent(tall);
    const plan = planWorldMap(tall, countries, new Set(["SG"]));
    const sg = markerOf(plan, "SG");
    expect(sg.y).toBeGreaterThan(y0);
    expect(sg.y).toBeLessThan(y1);
  });
});
