import { describe, expect, test } from "vitest";
import {
  loadRecords,
  parseStoredRecords,
  type RecordStorage,
  saveRecords,
  STORAGE_KEY,
} from "./storage";

const MAX_YEAR = 2026;

function stored(records: unknown, version: unknown = 1): string {
  return JSON.stringify({ version, records });
}

function fakeStorage(initial?: string): RecordStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  if (initial !== undefined) {
    items.set(STORAGE_KEY, initial);
  }
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

const throwingStorage: RecordStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("parseStoredRecords", () => {
  test("保存された記録を復元する", () => {
    const records = [
      { year: 2016, country: "JP" },
      { year: 2024, country: "FR" },
    ];
    expect(parseStoredRecords(stored(records), MAX_YEAR)).toEqual(records);
  });

  test("保存データがなければ空", () => {
    expect(parseStoredRecords(null, MAX_YEAR)).toEqual([]);
  });

  test("JSON として壊れていれば読み取れない", () => {
    expect(parseStoredRecords("{not json", MAX_YEAR)).toBeUndefined();
  });

  test("未知の版は読み取れない", () => {
    expect(parseStoredRecords(stored([], 3), MAX_YEAR)).toBeUndefined();
  });

  test("型の合わない要素と範囲外の年を除く", () => {
    const records = [
      { year: 2024, country: "JP" },
      { year: "2024", country: "FR" },
      { year: 2024, country: "france" },
      { year: 1899, country: "US" },
      { year: MAX_YEAR + 1, country: "US" },
      { year: 2020.5, country: "US" },
      null,
    ];
    expect(parseStoredRecords(stored(records), MAX_YEAR)).toEqual([{ year: 2024, country: "JP" }]);
  });

  test("重複を除く", () => {
    const records = [
      { year: 2024, country: "JP" },
      { year: 2024, country: "JP" },
    ];
    expect(parseStoredRecords(stored(records), MAX_YEAR)).toEqual([{ year: 2024, country: "JP" }]);
  });

  test("余分なプロパティは持ち込まない", () => {
    const records = [{ year: 2024, country: "JP", extra: true }];
    expect(parseStoredRecords(stored(records), MAX_YEAR)).toEqual([{ year: 2024, country: "JP" }]);
  });
});

describe("loadRecords", () => {
  test("保存先から記録を読み込む", () => {
    const storage = fakeStorage(stored([{ year: 2024, country: "JP" }]));
    expect(loadRecords(storage, MAX_YEAR)).toEqual({
      records: [{ year: 2024, country: "JP" }],
      persistent: true,
    });
  });

  test("読み取れないデータは空の記録として扱い、保存先の値は消さない", () => {
    const storage = fakeStorage("{broken");
    expect(loadRecords(storage, MAX_YEAR)).toEqual({ records: [], persistent: true });
    expect(storage.items.get(STORAGE_KEY)).toBe("{broken");
  });

  test("保存先へのアクセスが例外を投げれば保存できない状態になる", () => {
    expect(loadRecords(throwingStorage, MAX_YEAR)).toEqual({ records: [], persistent: false });
  });

  test("保存先がなければ保存できない状態になる", () => {
    expect(loadRecords(undefined, MAX_YEAR)).toEqual({ records: [], persistent: false });
  });
});

describe("saveRecords", () => {
  test("保存した記録を読み込める", () => {
    const storage = fakeStorage();
    const records = [{ year: 2024, country: "JP" }];
    expect(saveRecords(storage, records)).toBe(true);
    expect(loadRecords(storage, MAX_YEAR).records).toEqual(records);
  });

  test("保存先が例外を投げれば false を返す", () => {
    expect(saveRecords(throwingStorage, [])).toBe(false);
  });
});
