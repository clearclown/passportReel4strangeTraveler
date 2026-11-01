import { describe, expect, test } from "vitest";
import {
  attributeText,
  browseReducer,
  catalog,
  CATEGORIES,
  INITIAL_BROWSE_STATE,
  INITIAL_FILTERS,
  paginate,
  regionAttributes,
  regionsById,
  reviewCounts,
  searchRegions,
  searchSubdivisions,
  sourcesById,
  statusLabel,
} from "./catalog";

describe("台帳原本の整合性", () => {
  test("識別子とコードが一意で、出典・国・親子・対応先が実在する", () => {
    expect(regionsById.size).toBe(catalog.regions.length);
    expect(sourcesById.size).toBe(catalog.sources.length);
    const contexts = new Set(catalog.reviews.map((entry) => entry.contextCode));
    const codes = new Set(catalog.subdivisions.map((entry) => entry.code));
    expect(codes.size).toBe(catalog.subdivisions.length);
    for (const entry of catalog.regions) {
      for (const code of entry.contextCodes) expect(contexts.has(code)).toBe(true);
      for (const code of entry.subdivisionCodes) expect(codes.has(code)).toBe(true);
      for (const ref of [
        ...entry.sourceRefs,
        ...entry.statements.flatMap((s) => s.sourceRefs),
        ...entry.relationships.flatMap((r) => r.sourceRefs),
      ])
        expect(sourcesById.has(ref)).toBe(true);
      for (const relation of entry.relationships)
        expect(regionsById.has(relation.targetId)).toBe(true);
    }
    for (const entry of catalog.subdivisions) {
      expect(contexts.has(entry.contextCode)).toBe(true);
      expect(codes.has(entry.parentCode) || contexts.has(entry.parentCode)).toBe(true);
    }
    for (const entry of catalog.subdivisions.filter((row) => row.linkedRegionId !== null))
      expect(regionsById.get(entry.linkedRegionId ?? "")?.subdivisionCodes).toContain(entry.code);
    for (const group of catalog.coverage) {
      expect(new Set(group.regionIds).size).toBe(group.expectedCount);
      for (const id of group.regionIds) expect(regionsById.has(id)).toBe(true);
      for (const ref of group.sourceRefs) expect(sourcesById.has(ref)).toBe(true);
    }
  });

  test("既存候補を保持し、現存する追加地域だけを訪問先へ採用する", () => {
    const existing = catalog.regions.filter((entry) => entry.origin === "existing-app");
    expect(existing).toHaveLength(250);
    expect(new Set(existing.map((entry) => entry.applicationCode)).size).toBe(existing.length);
    expect(
      catalog.regions
        .filter(
          (entry) =>
            entry.origin === "research-candidate" &&
            entry.temporal.status !== "historical-candidate",
        )
        .every(
          (entry) => entry.decision.status === "accepted" && entry.applicationCode === entry.id,
        ),
    ).toBe(true);
    expect(
      catalog.subdivisions.every(
        (entry) =>
          entry.classificationStatus === "unreviewed" && entry.decisionStatus === "unreviewed",
      ),
    ).toBe(true);
    expect(catalog.subdivisions.find((entry) => entry.code === "PH-14")?.linkedRegionId).toBeNull();
    expect(
      catalog.regions
        .filter((entry) => entry.temporal.status === "historical-candidate")
        .every((entry) => entry.decision.status === "pending" && entry.applicationCode === null),
    ).toBe(true);
  });
});

describe("地域の検索・分類", () => {
  const ids = (query: string) =>
    searchRegions({ ...INITIAL_FILTERS, query }).map((entry) => entry.id);
  test("かな・原名・別名・全角小文字コードで同じ地域が見つかる", () => {
    for (const query of ["ががうじあ", "GAGAUZIA", "ｍｄ－ｇａ"])
      expect(ids(query)).toContain("region:gagauzia");
    expect(ids("くりすちゃにあ")).toContain("region:christiania");
    expect(ids("中国")).toContain("iso3166-1:CN");
    expect(ids("韓国")).toContain("iso3166-1:KR");
  });
  test("条件をANDで適用し、一つの地域を複数の分類から探せる", () => {
    const filters = { ...INITIAL_FILTERS, context: "MD", origin: "research-candidate" };
    expect(searchRegions(filters).map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["region:gagauzia", "region:transnistria"]),
    );
    expect(
      searchRegions({ ...filters, category: "autonomy", review: "documented" }).map(
        (entry) => entry.id,
      ),
    ).toEqual(["region:gagauzia"]);
    for (const category of ["autonomy", "administrative"])
      expect(searchRegions({ ...INITIAL_FILTERS, category }).map((entry) => entry.id)).toContain(
        "region:catalonia",
      );
    expect(searchRegions({ ...filters, query: "クリスチャニア" })).toEqual([]);
  });
  test("空入力は全件、未知の文字列は0件、同順位は安定した順序になる", () => {
    expect(searchRegions({ ...INITIAL_FILTERS, query: "　 " })).toHaveLength(
      catalog.regions.length,
    );
    expect(ids("該当しない地域xyz")).toEqual([]);
    const guinea = ids("ギニア");
    expect(guinea.indexOf("iso3166-1:GN")).toBeLessThan(guinea.indexOf("iso3166-1:PG"));
    expect(ids("ギニア")).toEqual(guinea);
  });
  test("すべての分類タグが表示または探索用に定義される", () => {
    const tags = new Set(CATEGORIES.flatMap((category) => category.tags));
    for (const tag of catalog.regions.flatMap((entry) => entry.tags))
      expect(tag === "baseline" || tags.has(tag)).toBe(true);
  });
});

describe("参照一覧とページ分割", () => {
  test("条件・モード変更では先頭へ戻り、ページ移動では検索条件を保つ", () => {
    const later = { ...INITIAL_BROWSE_STATE, page: 3 };
    const filtered = browseReducer(later, { type: "filters", filters: { context: "MD" } });
    expect(filtered.page).toBe(0);
    expect(filtered.filters.context).toBe("MD");
    expect(browseReducer(filtered, { type: "page", page: 2 }).filters).toEqual(filtered.filters);
    expect(browseReducer(later, { type: "mode", mode: "subdivisions" })).toMatchObject({
      mode: "subdivisions",
      page: 0,
    });
    expect(browseReducer(filtered, { type: "reset" }).filters).toEqual(INITIAL_FILTERS);
  });
  test("行政区画は原名・コード・上位コードで探し、地域専用の条件を流用しない", () => {
    const filters = {
      ...INITIAL_FILTERS,
      context: "ID",
      category: "community",
      review: "documented",
      origin: "research-candidate",
    };
    const entries = searchSubdivisions(filters);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.contextCode === "ID")).toBe(true);
    for (const query of ["ｉｄ－ｙｏ", "yOgYaKaRtA"])
      expect(searchSubdivisions({ ...filters, query }).map((entry) => entry.code)).toContain(
        "ID-YO",
      );
    expect(searchSubdivisions({ ...INITIAL_FILTERS, query: "該当しないxyz" })).toEqual([]);
  });
  test("全件を重複なく最後まで閲覧でき、空結果や範囲外のページでも破綻しない", () => {
    const entries = searchSubdivisions(INITIAL_FILTERS);
    const first = paginate(entries, 0);
    const all = Array.from(
      { length: first.pages },
      (_, page) => paginate(entries, page).entries,
    ).flat();
    expect(all).toEqual(entries);
    expect(paginate(entries, 999).to).toBe(entries.length);
    expect(paginate(entries, -1).page).toBe(0);
    expect(paginate([], 5)).toMatchObject({ page: 0, pages: 1, from: 0, to: 0, entries: [] });
  });
});

describe("確認状態の表示", () => {
  test("未入力を不存在に変換せず、原本の既定値を使う", () => {
    const region = catalog.regions[0];
    expect(region).toBeDefined();
    if (!region) return;
    expect(attributeText(regionAttributes(region).ccTlds)).toBe("未入力");
    expect(regionAttributes(region).autonomyPowers.legislation).toBe("unreviewed");
    expect(attributeText(null)).not.toContain("なし");
    expect(attributeText([".example"])).toBe(".example");
    expect(statusLabel("needs-current-verification")).toContain("照合が必要");
    expect(statusLabel("unknown-future-status")).toBe("未確認");
  });
  test("国別の進捗だけを集計し、限定的な収録照合を完了国に加算しない", () => {
    const counts = reviewCounts();
    expect(counts.complete + counts.partial + counts.unreviewed).toBe(catalog.reviews.length);
    expect(counts.complete).toBe(
      catalog.reviews.filter((entry) => entry.overallStatus === "complete").length,
    );
    expect(catalog.coverage.length).toBeGreaterThan(0);
    expect(catalog.coverage.every((entry) => entry.rightsReviewStatus === "incomplete")).toBe(true);
  });
});
