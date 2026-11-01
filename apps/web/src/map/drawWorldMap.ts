import type { Feature, Polygon } from "geojson";
import { geoGraticule10, geoMercator, geoPath } from "d3-geo";
import { isVisited, type MapCountry } from "./countries";

/** 描画関数が使う Canvas 2D コンテキストの機能。テストでは記録用のフェイクを渡す。 */
export type MapContext = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "fillRect"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "arc"
  | "closePath"
  | "fill"
  | "stroke"
>;

export type MapSize = { readonly width: number; readonly height: number };

/**
 * 地図の配色。Canvas からは CSS 変数を読めないため値を直接持つ。
 * docs/design-guidelines.md の「地図の配色」と一致させる（海は画面の背景色 --bg と同じにして地図の枠を見せない）。
 */
export const MAP_COLORS = {
  ocean: "#0b1019",
  graticule: "rgba(255, 255, 255, 0.045)",
  unvisited: "#232c3f",
  visited: "#f2a93b",
  border: "#0b1019",
  marker: "#f2a93b",
  markerRing: "rgba(242, 169, 59, 0.55)",
  emphasized: "#ffd27a",
  emphasizedGlow: "rgba(255, 210, 122, 0.85)",
} as const;

/**
 * 投影後の面積（px²）がこれ未満の訪問国にはマーカーを描く。
 * 固定の国リストではなく表示サイズに対する面積で判定し、Canvas のサイズが変わっても「見えにくい国」を拾えるようにする。
 */
const SMALL_COUNTRY_AREA_THRESHOLD = 30;

type MapMarker = { readonly alpha2: string; readonly x: number; readonly y: number };

export type WorldMapPlan = {
  readonly fills: readonly { readonly country: MapCountry; readonly color: string }[];
  readonly markers: readonly MapMarker[];
};

/**
 * 表示する緯度の範囲。メルカトル図法は極に近づくほど無限に引き伸ばされるため上下を切る。
 * 北はグリーンランド北端まで含める。南は南極を沿岸部だけ残し、AQ を訪問済みにしたときのハイライトが見えるようにする。
 */
const NORTH_LIMIT = 84;
const SOUTH_LIMIT = -70;

function mercatorY(latitude: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));
}

/** 表示範囲の横:縦の比。地図を歪ませずに収める大きさを決めるのに使う。 */
export const MAP_ASPECT_RATIO = (2 * Math.PI) / (mercatorY(NORTH_LIMIT) - mercatorY(SOUTH_LIMIT));

type MapExtent = [[number, number], [number, number]];

/**
 * 描画領域の中で地図を置く範囲。縦横比を保ったまま領域に収まる最大の大きさにして中央に置く。
 * 描画領域は画面の形（PC の横長、スマートフォンの縦長）に合わせて変わるため、余った部分は海の色で埋める。
 */
export function mapExtent(size: MapSize): MapExtent {
  const width = Math.min(size.width, size.height * MAP_ASPECT_RATIO);
  const height = width / MAP_ASPECT_RATIO;
  const x0 = (size.width - width) / 2;
  const y0 = (size.height - height) / 2;
  return [
    [x0, y0],
    [x0 + width, y0 + height],
  ];
}

function createProjection(size: MapSize) {
  const extent = mapExtent(size);
  return geoMercator()
    .fitExtent(extent, {
      type: "MultiPoint",
      coordinates: [
        [-180, NORTH_LIMIT],
        [180, SOUTH_LIMIT],
      ],
    })
    .clipExtent(extent);
}

/** 複数のポリゴンからなる国は、最大のポリゴンの重心を使う（飛び地にマーカーが寄らないようにする）。 */
function markerPosition(
  path: ReturnType<typeof geoPath>,
  countryFeature: Feature,
): [number, number] {
  const geometry = countryFeature.geometry;
  if (geometry.type !== "MultiPolygon") {
    return path.centroid(countryFeature);
  }
  const polygons = geometry.coordinates.map((coordinates): Polygon => ({
    type: "Polygon",
    coordinates,
  }));
  const largest = polygons.reduce((a, b) => (path.area(b) > path.area(a) ? b : a));
  return path.centroid(largest);
}

/** 訪問国の集合から、各国の塗り色とマーカーの位置を決める。 */
export function planWorldMap(
  size: MapSize,
  countries: readonly MapCountry[],
  visited: ReadonlySet<string>,
): WorldMapPlan {
  const path = geoPath(createProjection(size));
  const fills = countries
    .filter(
      (country) =>
        country.feature.geometry.type !== "Point" &&
        (!country.overlay || isVisited(country, visited)),
    )
    .map((country) => ({
      country,
      color: isVisited(country, visited) ? MAP_COLORS.visited : MAP_COLORS.unvisited,
    }));
  // 国境データには同じ国の形状が別々に入っていることがある（例: AU の本土とアシュモア・カルティエ諸島）。
  // 「国として見えにくいか」で判定するため、国ごとに形状をまとめて面積を合算する。
  const visitedFeatures = new Map<string, Feature[]>();
  for (const country of countries) {
    if (country.alpha2 !== undefined && isVisited(country, visited)) {
      visitedFeatures.set(country.alpha2, [
        ...(visitedFeatures.get(country.alpha2) ?? []),
        country.feature,
      ]);
    }
  }
  const markers = [...visitedFeatures].flatMap(([alpha2, features]): MapMarker[] => {
    const totalArea = features.reduce((sum, f) => sum + path.area(f), 0);
    if (totalArea >= SMALL_COUNTRY_AREA_THRESHOLD) {
      return [];
    }
    const largest = features.reduce((a, b) => (path.area(b) > path.area(a) ? b : a));
    const [x, y] = markerPosition(path, largest);
    return [{ alpha2, x, y }];
  });
  return { fills, markers };
}

/**
 * 平面の世界地図を描く。
 * 後続のアニメーション・動画書き出しで「時刻 t のフレーム」を確定的に描くため、非同期処理や DOM に依存せず同期的に描き切る。
 */
export function drawWorldMap(
  ctx: MapContext,
  size: MapSize,
  countries: readonly MapCountry[],
  visited: ReadonlySet<string>,
): void {
  const path = geoPath(createProjection(size), ctx);
  const plan = planWorldMap(size, countries, visited);

  ctx.fillStyle = MAP_COLORS.ocean;
  ctx.fillRect(0, 0, size.width, size.height);

  ctx.beginPath();
  path(geoGraticule10());
  ctx.strokeStyle = MAP_COLORS.graticule;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = MAP_COLORS.border;
  ctx.lineWidth = 0.5;
  for (const { country, color } of plan.fills) {
    ctx.beginPath();
    path(country.feature);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  }

  // マーカーは地図の幅に比例させ、動画の高解像度でも見え方を変えない
  const [[x0], [x1]] = mapExtent(size);
  const dotRadius = Math.max(3, (x1 - x0) / 330);
  for (const marker of plan.markers) {
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, dotRadius * 2.2, 0, 2 * Math.PI);
    ctx.strokeStyle = MAP_COLORS.markerRing;
    ctx.lineWidth = dotRadius / 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(marker.x, marker.y, dotRadius, 0, 2 * Math.PI);
    ctx.fillStyle = MAP_COLORS.marker;
    ctx.fill();
  }
}

/** 強調描画で使う Canvas 2D コンテキストの機能。光彩（shadow）を扱う分だけ MapContext より多い。 */
export type EmphasisContext = MapContext &
  Pick<CanvasRenderingContext2D, "shadowBlur" | "shadowColor" | "save" | "restore">;

function mixColor(from: string, to: string, ratio: number): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const a = channels(from);
  const b = channels(to);
  const mixed = a.map((value, i) => Math.round(value + ((b[i] ?? value) - value) * ratio));
  return `rgb(${mixed.join(", ")})`;
}

/**
 * 指定した国を強調色と光彩で、描画済みの地図の上に描き重ねる（プレビューで「その年に初めて訪れた国」を示す）。
 * strength（0〜1）でハイライト色から強調色への変化と光彩の強さを決め、0 では光彩を付けない。
 * shadowBlur は座標変換の拡大縮小を受けないため、1 単位あたりの実ピクセル数を pixelScale で受け取って掛ける。
 */
export function drawEmphasizedCountries(
  ctx: EmphasisContext,
  size: MapSize,
  countries: readonly MapCountry[],
  codes: ReadonlySet<string>,
  strength: number,
  pixelScale = 1,
): void {
  if (codes.size === 0) {
    return;
  }
  const path = geoPath(createProjection(size), ctx);
  const plan = planWorldMap(size, countries, codes);
  const color = mixColor(MAP_COLORS.visited, MAP_COLORS.emphasized, strength);
  const [[x0], [x1]] = mapExtent(size);

  ctx.save();
  ctx.shadowColor = MAP_COLORS.emphasizedGlow;
  ctx.shadowBlur = strength * ((x1 - x0) / 60) * pixelScale;
  ctx.fillStyle = color;
  for (const { country } of plan.fills) {
    if (isVisited(country, codes)) {
      ctx.beginPath();
      path(country.feature);
      ctx.fill();
    }
  }
  const dotRadius = Math.max(3, (x1 - x0) / 330);
  for (const marker of plan.markers) {
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, dotRadius * 1.4, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}
