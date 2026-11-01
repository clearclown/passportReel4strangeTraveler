import { getNames, registerLocale } from "i18n-iso-countries";
import ja from "i18n-iso-countries/langs/ja.json";
import additionalDestinations from "../regions/destinations.json";

registerLocale(ja);

export type CountryName = {
  /** 既存の国コード、または台帳の安定した地域ID。 */
  readonly code: string;
  /** 既存の日本語名、または台帳で定めた地域名。 */
  readonly name: string;
  readonly originalName?: string;
  readonly aliases?: readonly string[];
  readonly kind?: string;
};

/**
 * 日本語データの名称と異なる、一般的な呼び名。
 * 日本語データは「大韓民国」「中華人民共和国」のような正式名称が多く、普段の呼び名では部分一致しないものだけを持つ。
 */
export const COUNTRY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  KR: ["韓国"],
  KP: ["北朝鮮"],
  CN: ["中国"],
  US: ["米国"],
  GB: ["英国"],
  SZ: ["エスワティニ"],
};

/** 既存の国・地域と台帳で採用した追加地域。既存コードと名称は維持する。 */
export const COUNTRY_NAMES: readonly CountryName[] = [
  ...Object.entries(getNames("ja")).map(([code, name]) => ({ code, name })),
  ...additionalDestinations,
].toSorted((a, b) => a.name.localeCompare(b.name, "ja"));

const nameByCode = new Map(COUNTRY_NAMES.map(({ code, name }) => [code, name]));
const countryByCode = new Map(COUNTRY_NAMES.map((country) => [country.code, country]));

export function findCountry(code: string): CountryName | undefined {
  return countryByCode.get(code);
}

/** 内部の地域IDをバッジに出さず、コードがない訪問先には種別を示す。 */
export function countryBadge(code: string): string {
  return countryByCode.get(code)?.kind ?? (code.startsWith("region:") ? "地域" : code);
}

/** 国コードの日本語名。日本語名を持たないコードはコードをそのまま返す。 */
export function countryName(code: string): string {
  return nameByCode.get(code) ?? (code.startsWith("region:") ? "未登録の地域" : code);
}

/**
 * 検索用に文字列をそろえる。
 * 全角・半角の違い（NFKC）とひらがな・カタカナの違いをなくし、表記が揺れやすい中黒と空白を除く。
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
    .replace(/[・\s]/g, "");
}

const searchIndex = COUNTRY_NAMES.map((country) => ({
  country,
  keys: [
    country.name,
    country.originalName ?? "",
    country.code,
    ...(country.aliases ?? []),
    ...(COUNTRY_ALIASES[country.code] ?? []),
  ].map((text) => normalizeForSearch(text).toLowerCase()),
}));

const MAX_CANDIDATES = 8;

/** 日本語名・原名・別名・コードに部分一致する訪問先を、前方一致を先にして最大8件返す。 */
export function searchCountries(query: string): readonly CountryName[] {
  const normalized = normalizeForSearch(query).toLowerCase();
  if (normalized === "") {
    return [];
  }
  const matched = searchIndex.filter(({ keys }) => keys.some((key) => key.includes(normalized)));
  const isPrefix = ({ keys }: (typeof searchIndex)[number]) =>
    keys.some((key) => key.startsWith(normalized));
  return [...matched.filter(isPrefix), ...matched.filter((entry) => !isPrefix(entry))]
    .slice(0, MAX_CANDIDATES)
    .map(({ country }) => country);
}
