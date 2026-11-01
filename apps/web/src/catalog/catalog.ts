import regionData from "../../../../docs/region-catalog/regions.json";
import subdivisionData from "../../../../docs/region-catalog/subdivision-candidates.json";
import sourceData from "../../../../docs/region-catalog/sources.json";
import reviewData from "../../../../docs/region-catalog/country-reviews.json";
import coverageData from "../../../../docs/region-catalog/coverage-groups.json";
import { COUNTRY_ALIASES, normalizeForSearch } from "../records/countryNames";

type Powers = Readonly<Record<keyof typeof regionData.defaults.autonomyPowers, string>>;
type Attributes = {
  readonly telephoneCountryCodes: readonly string[] | null;
  readonly ccTlds: readonly string[] | null;
  readonly autonomyPowers: Powers;
  readonly effectiveAutonomyPowers: Powers;
};

export type Region = (typeof regionData.entries)[number] & Partial<Attributes>;
export type Subdivision = (typeof subdivisionData.entries)[number];
export type Source = (typeof sourceData.entries)[number];
const regions: readonly Region[] = regionData.entries;

/** 調査原本をそのまま参照する。訪問記録に採用する候補の判定はここでは行わない。 */
export const catalog = {
  snapshotDate: regionData.snapshotDate,
  regions,
  subdivisions: subdivisionData.entries,
  sources: sourceData.entries,
  reviews: reviewData.entries,
  coverage: coverageData.entries,
};

export const regionsById = new Map(catalog.regions.map((entry) => [entry.id, entry]));
export const sourcesById = new Map<string, Source>(
  catalog.sources.map((entry) => [entry.id, entry]),
);
export const contexts = catalog.reviews.toSorted((a, b) => a.nameJa.localeCompare(b.nameJa, "ja"));
const contextNames = new Map(contexts.map((entry) => [entry.contextCode, entry.nameJa]));

export function contextName(code: string): string {
  return contextNames.get(code) ?? code;
}

export const TAG_LABELS: Readonly<Record<string, string>> = {
  baseline: "既存の選択肢",
  "special-autonomy": "特別自治",
  "special-autonomy-candidate": "自治制度の候補",
  "republic-with-special-status": "特別な地位を持つ共和国",
  "constituent-entity": "構成体",
  "regional-self-government": "地域自治",
  "self-governing-community": "自治共同体",
  "cultural-community": "文化共同体",
  "symbolic-republic": "象徴的な共和国",
  "de-facto-entity-candidate": "実効統治の調査候補",
  "disputed-status-candidate": "係争状態の調査候補",
  "federal-region-candidate": "連邦地域の調査候補",
  "indigenous-self-government": "先住民の自治政府",
  "indigenous-territory": "先住民領域",
  "administrative-subdivision-candidate": "行政区画の調査候補",
  "micronation-claim": "ミクロネーションの主張",
  "historical-entity": "歴史上の統治体の候補",
  "autonomous-community": "自治州",
  "autonomous-city": "自治都市",
  "autonomous-province": "自治県",
  "provincial-autonomous-region": "省級自治区",
  "special-status-candidate": "特別な地位の調査候補",
};

/** タグは重複するため、地域を単一の分類に割り当てず、各集合との一致を調べる。 */
export const CATEGORIES = [
  { id: "all", label: "すべての分類", tags: [] },
  {
    id: "autonomy",
    label: "自治制度・特別な地位",
    tags: [
      "special-autonomy",
      "special-autonomy-candidate",
      "republic-with-special-status",
      "regional-self-government",
      "autonomous-community",
      "autonomous-city",
      "autonomous-province",
      "provincial-autonomous-region",
      "special-status-candidate",
    ],
  },
  {
    id: "constituent",
    label: "構成体・連邦地域の候補",
    tags: ["constituent-entity", "federal-region-candidate"],
  },
  {
    id: "indigenous",
    label: "先住民の自治・領域",
    tags: ["indigenous-self-government", "indigenous-territory"],
  },
  {
    id: "disputed",
    label: "係争状態・実効統治の候補",
    tags: ["de-facto-entity-candidate", "disputed-status-candidate"],
  },
  {
    id: "community",
    label: "共同体・ミクロネーション",
    tags: [
      "self-governing-community",
      "cultural-community",
      "symbolic-republic",
      "micronation-claim",
    ],
  },
  { id: "historical", label: "歴史上の統治体の候補", tags: ["historical-entity"] },
  {
    id: "administrative",
    label: "行政区画の調査候補",
    tags: ["administrative-subdivision-candidate"],
  },
];

export const INITIAL_FILTERS = {
  query: "",
  context: "",
  category: "all",
  review: "all",
  origin: "all",
};
export type Filters = typeof INITIAL_FILTERS;
type CatalogMode = "regions" | "subdivisions";

type BrowseState = { readonly filters: Filters; readonly mode: CatalogMode; readonly page: number };
type BrowseAction =
  | { readonly type: "filters"; readonly filters: Partial<Filters> }
  | { readonly type: "mode"; readonly mode: CatalogMode }
  | { readonly type: "page"; readonly page: number }
  | { readonly type: "reset" };
export const INITIAL_BROWSE_STATE: BrowseState = {
  filters: INITIAL_FILTERS,
  mode: "regions",
  page: 0,
};

/** 条件の変更とページのリセットを一緒に行い、絞り込み後に空の後続ページを残さない。 */
export function browseReducer(state: BrowseState, action: BrowseAction): BrowseState {
  switch (action.type) {
    case "filters":
      return { ...state, filters: { ...state.filters, ...action.filters }, page: 0 };
    case "mode":
      return { ...state, mode: action.mode, page: 0 };
    case "page":
      return { ...state, page: action.page };
    case "reset":
      return { ...state, filters: INITIAL_FILTERS, page: 0 };
    default:
      return state;
  }
}

function normalize(text: string): string {
  return normalizeForSearch(text).toLocaleLowerCase("en");
}

const regionIndex = catalog.regions.map((entry) => ({
  entry,
  keys: [
    entry.nameJa,
    entry.nameOriginal,
    ...entry.aliases,
    entry.applicationCode ?? "",
    ...entry.subdivisionCodes,
    ...(entry.applicationCode ? (COUNTRY_ALIASES[entry.applicationCode] ?? []) : []),
  ].map(normalize),
}));
const subdivisionIndex = catalog.subdivisions.map((entry) => ({
  entry,
  keys: [entry.nameOriginal, entry.code, entry.parentCode].map(normalize),
}));

function matchRank(keys: readonly string[], query: string): number {
  if (!query) return 0;
  if (keys.some((key) => key.startsWith(query))) return 0;
  return keys.some((key) => key.includes(query)) ? 1 : 2;
}

export function searchRegions(filters: Filters): readonly Region[] {
  const query = normalize(filters.query);
  const tags = CATEGORIES.find(({ id }) => id === filters.category)?.tags ?? [];
  return regionIndex
    .filter(
      ({ entry, keys }) =>
        matchRank(keys, query) < 2 &&
        (!filters.context || entry.contextCodes.includes(filters.context)) &&
        (!tags.length || tags.some((tag) => entry.tags.includes(tag))) &&
        (filters.review === "all" || entry.classificationStatus === filters.review) &&
        (filters.origin === "all" || entry.origin === filters.origin),
    )
    .toSorted(
      (a, b) =>
        matchRank(a.keys, query) - matchRank(b.keys, query) ||
        a.entry.nameJa.localeCompare(b.entry.nameJa, "ja") ||
        a.entry.id.localeCompare(b.entry.id),
    )
    .map(({ entry }) => entry);
}

/** 行政区画には重点台帳の分類・採否を流用しない。原名とコードの参照一覧として検索する。 */
export function searchSubdivisions(filters: Filters): readonly Subdivision[] {
  const query = normalize(filters.query);
  return subdivisionIndex
    .filter(
      ({ entry, keys }) =>
        (!filters.context || entry.contextCode === filters.context) && matchRank(keys, query) < 2,
    )
    .toSorted(
      (a, b) =>
        matchRank(a.keys, query) - matchRank(b.keys, query) ||
        a.entry.code.localeCompare(b.entry.code),
    )
    .map(({ entry }) => entry);
}

const PAGE_SIZE = 50;

export function paginate<T>(entries: readonly T[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const page = Math.max(0, Math.min(Math.trunc(requestedPage), pages - 1));
  const start = page * PAGE_SIZE;
  return {
    entries: entries.slice(start, start + PAGE_SIZE),
    page,
    pages,
    from: entries.length ? start + 1 : 0,
    to: Math.min(start + PAGE_SIZE, entries.length),
  };
}

export function regionAttributes(region: Region): Attributes {
  return { ...regionData.defaults, ...region };
}

export function attributeText(value: readonly string[] | null): string {
  return value === null ? "未入力" : value.length ? value.join("、") : "該当なし（確認済み）";
}

const STATUS_LABELS: Readonly<Record<string, string>> = {
  documented: "資料に記述あり",
  unreviewed: "未確認",
  partial: "一部確認",
  complete: "調査完了",
  "needs-current-verification": "現在の状態と照合が必要",
  absent: "なし（確認済み）",
  "not-applicable": "対象外",
  imported: "取り込み済み",
  "snapshot-imported": "参照版を取り込み済み",
  "not-in-source-snapshot": "参照版に収録なし",
  accepted: "訪問先として記録できます",
  pending: "追加を検討中",
  excluded: "除外",
  reconciled: "出典の列挙と照合済み",
  incomplete: "未完了",
};

export function statusLabel(value: string): string {
  return STATUS_LABELS[value] ?? "未確認";
}

export function reviewCounts() {
  return catalog.reviews.reduce(
    (counts, entry) => {
      const status: string = entry.overallStatus;
      if (status === "complete") counts.complete++;
      else if (status === "partial") counts.partial++;
      else counts.unreviewed++;
      return counts;
    },
    { complete: 0, partial: 0, unreviewed: 0 },
  );
}
