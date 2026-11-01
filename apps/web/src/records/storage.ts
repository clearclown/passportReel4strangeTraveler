import { addRecord, MIN_YEAR, type VisitRecord } from "./visitRecords";

export const STORAGE_KEY = "passport-reel:visit-records";

/** 保存形式の版。形式を変えるときは上げ、古い版の読み替えを parseStoredRecords に足す。 */
const STORAGE_VERSION = 2;

/** 保存先として使う Storage の機能。テストではフェイクを渡す。 */
export type RecordStorage = Pick<Storage, "getItem" | "setItem">;

function isVisitRecord(value: unknown, maxYear: number, version: number): value is VisitRecord {
  if (typeof value !== "object" || value === null || !("year" in value) || !("country" in value)) {
    return false;
  }
  const { year, country } = value;
  return (
    typeof year === "number" &&
    Number.isInteger(year) &&
    year >= MIN_YEAR &&
    year <= maxYear &&
    typeof country === "string" &&
    (/^[A-Z]{2}$/.test(country) ||
      (version === 2 && /^region:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(country)))
  );
}

/**
 * 保存された文字列から記録を復元する。
 * 壊れた JSON や未知の版は丸ごと空として扱い、個々の不正な要素と重複は除いて残りを使う。
 */
export function parseStoredRecords(
  raw: string | null,
  maxYear: number,
): readonly VisitRecord[] | undefined {
  if (raw === null) {
    return [];
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof data !== "object" || data === null || !("version" in data) || !("records" in data)) {
    return undefined;
  }
  const { version, records } = data;
  if ((version !== 1 && version !== STORAGE_VERSION) || !Array.isArray(records)) {
    return undefined;
  }
  return records
    .filter((value: unknown) => isVisitRecord(value, maxYear, version))
    .reduce<readonly VisitRecord[]>(
      (acc, { year, country }) => addRecord(acc, { year, country }),
      [],
    );
}

export type LoadResult = {
  readonly records: readonly VisitRecord[];
  /** 保存先を使えるか。false のときは表示中のメモリ上だけで記録を扱う。 */
  readonly persistent: boolean;
};

/**
 * 保存先から記録を読み込む。
 * 読み取れないデータは空の記録として扱うが、保存先の値は消さない（ユーザーが記録を変えるまで上書きしない）。
 */
export function loadRecords(storage: RecordStorage | undefined, maxYear: number): LoadResult {
  if (!storage) {
    return { records: [], persistent: false };
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return { records: parseStoredRecords(raw, maxYear) ?? [], persistent: true };
  } catch {
    return { records: [], persistent: false };
  }
}

/** 記録全体を保存する。保存できなかった場合は false を返す。 */
export function saveRecords(
  storage: RecordStorage | undefined,
  records: readonly VisitRecord[],
): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, records }));
    return true;
  } catch {
    return false;
  }
}

/**
 * ブラウザの localStorage を返す。
 * プライベートブラウズなどではプロパティの参照自体が例外を投げるため、その場合は undefined にする。
 */
export function browserStorage(): RecordStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
