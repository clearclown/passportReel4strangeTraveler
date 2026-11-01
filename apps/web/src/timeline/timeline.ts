import { countryName } from "../records/countryNames";
import type { VisitRecord } from "../records/visitRecords";

type YearEntry = {
  readonly year: number;
  /** その年に初めて訪れた国（既存コードまたは地域ID、日本語名の順） */
  readonly newCountries: readonly string[];
  /** その年に再訪した国（以前の年にも記録がある国。既存コードまたは地域ID、日本語名の順） */
  readonly revisitedCountries: readonly string[];
  /** その年までの累計の訪問国 */
  readonly cumulative: ReadonlySet<string>;
};

export type Timeline = {
  readonly years: readonly YearEntry[];
  readonly summary: {
    readonly firstYear: number;
    readonly lastYear: number;
    /** 訪れたすべての国（既存コードまたは地域ID、日本語名の順） */
    readonly countries: readonly string[];
  };
};

function byJapaneseName(codes: Iterable<string>): string[] {
  return [...codes].toSorted((a, b) => countryName(a).localeCompare(countryName(b), "ja"));
}

/**
 * 訪問記録から年ごとのタイムラインを作る。記録がなければ undefined。
 * 同じ国を複数年に訪れた場合は、最初の年だけ「初めて訪れた国」として数える。
 */
export function buildTimeline(records: readonly VisitRecord[]): Timeline | undefined {
  const years = [...new Set(records.map((r) => r.year))].toSorted((a, b) => a - b);
  const firstYear = years[0];
  const lastYear = years.at(-1);
  if (firstYear === undefined || lastYear === undefined) {
    return undefined;
  }
  const seen = new Set<string>();
  const entries = years.map((year): YearEntry => {
    const countries = records.filter((r) => r.year === year).map((r) => r.country);
    const newCountries = countries.filter((c) => !seen.has(c));
    const revisitedCountries = countries.filter((c) => seen.has(c));
    for (const country of newCountries) {
      seen.add(country);
    }
    return {
      year,
      newCountries: byJapaneseName(newCountries),
      revisitedCountries: byJapaneseName(revisitedCountries),
      cumulative: new Set(seen),
    };
  });
  return { years: entries, summary: { firstYear, lastYear, countries: byJapaneseName(seen) } };
}
