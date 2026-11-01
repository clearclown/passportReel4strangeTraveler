import type { Feature, Position } from "geojson";
import { numericToAlpha2 } from "i18n-iso-countries";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import additionalDestinations from "../regions/destinations.json";
import mapFallbacks from "../regions/mapFallbacks.json";

/** 地図上の1つの国（または国コードを持たない地域）の形状。 */
export type MapCountry = {
  /**
   * 既存の国コードまたは地域ID。既存の描画APIとの互換性のためalpha2というプロパティ名を維持する。
   */
  readonly alpha2: string | undefined;
  readonly feature: Feature;
  /** 国の上に重ねる地域。未訪問の色で親国の塗りを消さない。 */
  readonly overlay?: boolean;
};

type CountriesTopology = Topology<{ countries: GeometryCollection<{ readonly name?: unknown }> }>;

/** world-atlas@2.0.2で番号を持たない3形状を、固定版の名前で明示的に対応づける。 */
const NAME_CODES: Readonly<Record<string, string>> = {
  Kosovo: "XK",
  "N. Cyprus": "region:northern-cyprus",
  Somaliland: "region:somaliland",
};

/** 経緯度の範囲 [西端, 南端, 東端, 北端]。 */
type Bounds = readonly [number, number, number, number];

/**
 * 元データのコードから別の描画コードへ割り当てる島々の範囲。
 * 海外領土の分離と、日本向けの北方四島の表示方針をここで適用し、画面・動画の描画を統一する。
 * 輪郭は変更せず、外周全体が範囲内に収まる島だけを移す。
 */
const POLYGON_REASSIGNMENTS: Readonly<
  Record<string, readonly { alpha2: string; bounds: readonly Bounds[] }[]>
> = {
  FR: [
    { alpha2: "GF", bounds: [[-55, 2, -51, 6]] },
    { alpha2: "GP", bounds: [[-62, 15.8, -60.8, 16.6]] },
    { alpha2: "MQ", bounds: [[-61.5, 14.2, -60.5, 15]] },
    { alpha2: "YT", bounds: [[44, -13.5, 46, -12]] },
    { alpha2: "RE", bounds: [[55, -22, 56, -20.5]] },
  ],
  NO: [
    {
      alpha2: "SJ",
      bounds: [
        // ヤンマイエン島
        [-10, 70, -7, 72],
        // スヴァールバル諸島（ベア島を含む）
        [10, 74, 35, 81],
      ],
    },
  ],
  NL: [{ alpha2: "BQ", bounds: [[-69, 12, -62, 18]] }],
  RU: [
    {
      // 日本向けの表示として北方四島をJPへ割り当てる。得撫島やサハリンは含めない。
      // 方針の出典: https://www.mofa.go.jp/mofaj/area/hoppo/hoppo.html
      alpha2: "JP",
      bounds: [
        // 択捉島
        [146.8, 44.3, 149, 45.6],
        // 国後島
        [145.3, 43.6, 146.6, 44.6],
        // 色丹島
        [146.5, 43.6, 147, 44],
        // 歯舞群島（50mデータに存在する3形状）
        [145.8, 43.3, 146.4, 43.7],
      ],
    },
  ],
};

function contains(
  [west, south, east, north]: Bounds,
  [lon = Number.NaN, lat = Number.NaN]: Position,
) {
  return lon >= west && lon <= east && lat >= south && lat <= north;
}

/** 島の形状を保ち、表示方針に従って描画コードごとに分ける。 */
function splitCountryPolygons(alpha2: string, countryFeature: Feature): MapCountry[] {
  const reassignments = POLYGON_REASSIGNMENTS[alpha2];
  const geometry = countryFeature.geometry;
  if (reassignments === undefined || geometry.type !== "MultiPolygon") {
    return [{ alpha2, feature: countryFeature }];
  }
  const polygonsByCode = new Map<string, Position[][][]>([[alpha2, []]]);
  for (const polygon of geometry.coordinates) {
    const outerRing = polygon[0];
    const code =
      reassignments.find(
        ({ bounds }) =>
          outerRing !== undefined &&
          outerRing.length > 0 &&
          bounds.some((b) => outerRing.every((point) => contains(b, point))),
      )?.alpha2 ?? alpha2;
    polygonsByCode.set(code, [...(polygonsByCode.get(code) ?? []), polygon]);
  }
  return [...polygonsByCode].map(([code, coordinates]) => ({
    alpha2: code,
    feature: {
      ...countryFeature,
      // 元の国のidや名前を、別コードへ移した島に引き継がない
      ...(code === alpha2 ? {} : { id: undefined, properties: {} }),
      geometry: { type: "MultiPolygon", coordinates },
    },
  }));
}

/** world-atlas の TopoJSON（id は ISO 3166-1 numeric）を、alpha-2 で識別する国の一覧に変換する。 */
export function toMapCountries(topology: CountriesTopology): MapCountry[] {
  return feature(topology, topology.objects.countries).features.flatMap(
    (countryFeature): MapCountry[] => {
      const name: unknown = countryFeature.properties?.["name"];
      const alpha2 =
        (countryFeature.id === undefined ? undefined : numericToAlpha2(countryFeature.id)) ??
        (typeof name === "string" ? NAME_CODES[name] : undefined);
      return alpha2 === undefined
        ? [{ alpha2, feature: countryFeature }]
        : splitCountryPolygons(alpha2, countryFeature);
    },
  );
}

/**
 * 国境データを読み込む。
 * 小さな国の形状まで含む 50m 解像度を使う。約 750KB あるため動的 import で初期バンドルから分離する。
 */
export async function loadMapCountries(): Promise<MapCountry[]> {
  const [{ default: topology }, { srpskaGeometry }] = await Promise.all([
    import("world-atlas/countries-50m.json"),
    import("./regionGeometry"),
  ]);
  return withAdditionalRegions(toMapCountries(topology), srpskaGeometry);
}

/** 面として存在する地域に地点を重複追加せず、それ以外の採用地域を代表地点で表示する。 */
export function withAdditionalRegions(
  countries: readonly MapCountry[],
  srpskaGeometry: Feature,
): MapCountry[] {
  const shapes: MapCountry[] = [
    ...countries,
    { alpha2: "region:republika-srpska", feature: srpskaGeometry, overlay: true },
  ];
  const covered = new Set(shapes.map((entry) => entry.alpha2));
  return [
    ...shapes,
    ...[...additionalDestinations, ...mapFallbacks]
      .filter((entry) => !covered.has(entry.code))
      .map((entry): MapCountry => ({
        alpha2: entry.code,
        feature: {
          type: "Feature",
          properties: { name: entry.name },
          geometry: { type: "Point", coordinates: [entry.point.longitude, entry.point.latitude] },
        },
      })),
  ];
}

/** 地図の国が訪問済みかを判定する。地図に対応しない訪問国コードは単に一致しないだけで無視される。 */
export function isVisited(country: MapCountry, visited: ReadonlySet<string>): boolean {
  return country.alpha2 !== undefined && visited.has(country.alpha2);
}
