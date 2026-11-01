/**
 * 1件の訪問記録。記録の同一性は年と訪問先の組で決まるため ID は持たない。
 * countryは既存コードまたはregion:<slug>。互換性のためフィールド名を維持する。
 */
export type VisitRecord = { readonly year: number; readonly country: string };

export type YearGroup = { readonly year: number; readonly records: readonly VisitRecord[] };

/** 年の選択肢の下限。上限は現在の年。 */
export const MIN_YEAR = 1900;

export function hasRecord(records: readonly VisitRecord[], record: VisitRecord): boolean {
  return records.some((r) => r.year === record.year && r.country === record.country);
}

/** 記録を追加した新しい配列を返す。同じ年・同じ国の組が既にあれば元の配列をそのまま返す。 */
export function addRecord(
  records: readonly VisitRecord[],
  record: VisitRecord,
): readonly VisitRecord[] {
  return hasRecord(records, record) ? records : [...records, record];
}

export function removeRecord(
  records: readonly VisitRecord[],
  record: VisitRecord,
): readonly VisitRecord[] {
  return records.filter((r) => r.year !== record.year || r.country !== record.country);
}

/** 記録に含まれる訪問先の集合。同じ訪問先の複数年の記録は1件になる。 */
export function visitedCountries(records: readonly VisitRecord[]): ReadonlySet<string> {
  return new Set(records.map((r) => r.country));
}

/** 年ごとにまとめ、新しい年を先にする。年の中は追加した順を保つ。 */
export function groupByYear(records: readonly VisitRecord[]): readonly YearGroup[] {
  const byYear = new Map<number, VisitRecord[]>();
  for (const record of records) {
    byYear.set(record.year, [...(byYear.get(record.year) ?? []), record]);
  }
  return [...byYear.entries()]
    .toSorted(([a], [b]) => b - a)
    .map(([year, grouped]) => ({ year, records: grouped }));
}

/** より前の年にも同じ国の記録があるか。 */
export function isRevisit(records: readonly VisitRecord[], record: VisitRecord): boolean {
  return records.some((r) => r.country === record.country && r.year < record.year);
}
