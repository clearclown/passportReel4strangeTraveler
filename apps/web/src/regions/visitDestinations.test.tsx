import { renderToStaticMarkup } from "react-dom/server";
import { geoArea } from "d3-geo";
import topology from "world-atlas/countries-50m.json";
import { describe, expect, test } from "vitest";
import additional from "./destinations.json";
import registry from "../../../../docs/region-catalog/regions.json";
import points from "../../../../docs/region-catalog/map-locations.json";
import { COUNTRY_NAMES, countryBadge, countryName, searchCountries } from "../records/countryNames";
import { loadRecords, parseStoredRecords, saveRecords, STORAGE_KEY } from "../records/storage";
import { addRecord, visitedCountries } from "../records/visitRecords";
import { toMapCountries, withAdditionalRegions } from "../map/countries";
import { srpskaGeometry } from "../map/regionGeometry";
import { MAP_COLORS, planWorldMap } from "../map/drawWorldMap";
import { RecordForm } from "../records/RecordForm";
import { RecordList } from "../records/RecordList";
import { CatalogDetails } from "../catalog/CatalogDetails";
import { catalog } from "../catalog/catalog";
import { buildTimeline } from "../timeline/timeline";
import { buildReel } from "../timeline/reel";

const countries = withAdditionalRegions(toMapCountries(topology), srpskaGeometry);
const size = { width: 1080, height: 900 };
const transnistria = "region:transnistria";

describe("台帳と選択可能な訪問先の一致", () => {
  test("既存250件と追加65件が重複なく選べ、歴史上の1件は記録候補に出ない", () => {
    expect(COUNTRY_NAMES).toHaveLength(315);
    expect(additional).toHaveLength(65);
    expect(new Set(COUNTRY_NAMES.map((entry) => entry.code)).size).toBe(COUNTRY_NAMES.length);
    expect(additional.map((entry) => entry.code).toSorted()).toEqual(
      registry.entries
        .filter(
          (entry) => entry.origin === "research-candidate" && entry.decision.status === "accepted",
        )
        .map((entry) => entry.id)
        .toSorted(),
    );
    expect(searchCountries("クライナ・セルビア人共和国")).toEqual([]);
    expect(COUNTRY_NAMES.some((entry) => entry.code === "XK")).toBe(true);
  });
  test("全315件に形状または代表地点があり、実際に描画計画へ出る", () => {
    for (const entry of COUNTRY_NAMES) {
      const plan = planWorldMap(size, countries, new Set([entry.code]));
      const fills = plan.fills.filter(
        ({ country, color }) => country.alpha2 === entry.code && color === MAP_COLORS.visited,
      );
      const markers = plan.markers.filter((marker) => marker.alpha2 === entry.code);
      expect(fills.length + markers.length, `${entry.name}の描画がない`).toBeGreaterThan(0);
      expect(markers.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    }
  });
  test("追加65件は名称で検索でき、同じIDで保存・復元できる", () => {
    for (const entry of additional)
      expect(searchCountries(entry.name).map((candidate) => candidate.code)).toContain(entry.code);
    const records = additional.map((entry) => ({ year: 2024, country: entry.code }));
    expect(parseStoredRecords(JSON.stringify({ version: 2, records }), 2026)).toEqual(records);
    expect(
      points.entries.every(
        (entry) => entry.revision > 0 && entry.sourceUrl.includes(`oldid=${entry.revision}`),
      ),
    ).toBe(true);
  });
  test("沿ドニエストル共和国・原名・かなで同じ訪問先が見つかる", () => {
    for (const query of [
      "沿ドニエストル共和国",
      "沿ドニエストル",
      "TRANSNISTRIA",
      "とらんすにすとりあ",
    ])
      expect(searchCountries(query).map((entry) => entry.code)).toContain(transnistria);
    expect(countryBadge(transnistria)).toBe("地域");
    expect(countryName(transnistria)).toBe("沿ドニエストル");
  });
});

describe("地域を保存して再訪を再生する", () => {
  test("v1の既存5コードを保持し、追加・削除後はv2で保存する", () => {
    const legacy = ["JP", "XK", "AX", "GL", "FO"].map((country) => ({ year: 2016, country }));
    const items = new Map([[STORAGE_KEY, JSON.stringify({ version: 1, records: legacy })]]);
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => {
        items.set(key, value);
      },
    };
    const before = items.get(STORAGE_KEY);
    expect(loadRecords(storage, 2026).records).toEqual(legacy);
    expect(items.get(STORAGE_KEY)).toBe(before);
    const records = addRecord(legacy, { year: 2024, country: transnistria });
    expect(saveRecords(storage, records)).toBe(true);
    expect(JSON.parse(items.get(STORAGE_KEY) ?? "{}").version).toBe(2);
    expect(loadRecords(storage, 2026).records).toEqual(records);
    expect(saveRecords(storage, legacy)).toBe(true);
    expect(loadRecords(storage, 2026).records).toEqual(legacy);
  });
  test("v1に地域IDを混入させず、v2の未知の正しいIDは将来も保持する", () => {
    const records = [
      { year: 2024, country: "region:future-region" },
      { year: 2024, country: "region:<script>" },
    ];
    expect(parseStoredRecords(JSON.stringify({ version: 1, records }), 2026)).toEqual([]);
    expect(parseStoredRecords(JSON.stringify({ version: 2, records }), 2026)).toEqual([records[0]]);
  });
  test("重複を防ぎ、同じ地域の再訪と親国を独立して集計する", () => {
    const first = addRecord([], { year: 2019, country: transnistria });
    expect(addRecord(first, { year: 2019, country: transnistria })).toBe(first);
    const records = [
      ...first,
      { year: 2024, country: transnistria },
      { year: 2024, country: "MD" },
    ];
    expect(visitedCountries(records).size).toBe(2);
    const timeline = buildTimeline(records);
    if (!timeline) throw new Error("タイムラインがない");
    expect(timeline.years[0]?.newCountries).toEqual([transnistria]);
    expect(timeline.years[1]?.revisitedCountries).toEqual([transnistria]);
    const reel = buildReel(timeline, (text) => text.length * 20);
    expect(reel.summaryPages.flat()).toEqual(
      expect.arrayContaining(["沿ドニエストル", "モルドバ共和国"]),
    );
  });
});

describe("追加地域と親国の地図表示", () => {
  test("沿ドニエストルだけなら地点だけを表示してモルドバを塗らない", () => {
    const plan = planWorldMap(size, countries, new Set([transnistria]));
    expect(plan.markers.map((marker) => marker.alpha2)).toEqual([transnistria]);
    expect(plan.fills.find(({ country }) => country.alpha2 === "MD")?.color).toBe(
      MAP_COLORS.unvisited,
    );
    expect(planWorldMap(size, countries, new Set()).markers).toHaveLength(0);
  });
  test("追加境界は半球を反転させず、親国を未訪問色で上書きしない", () => {
    expect(geoArea(srpskaGeometry)).toBeGreaterThan(0);
    expect(geoArea(srpskaGeometry)).toBeLessThan(0.01);
    const regional = planWorldMap(size, countries, new Set(["region:republika-srpska"]));
    expect(
      regional.fills.find(({ country }) => country.alpha2 === "region:republika-srpska")?.color,
    ).toBe(MAP_COLORS.visited);
    expect(regional.fills.find(({ country }) => country.alpha2 === "BA")?.color).toBe(
      MAP_COLORS.unvisited,
    );
    const parent = planWorldMap(size, countries, new Set(["BA"]));
    expect(parent.fills.some(({ country }) => country.overlay)).toBe(false);
    expect(parent.fills.find(({ country }) => country.alpha2 === "BA")?.color).toBe(
      MAP_COLORS.visited,
    );
  });
  test("既存の面形状に追加の地点を重ねない", () => {
    for (const code of ["XK", "region:northern-cyprus", "region:somaliland"]) {
      const shapes = countries.filter((country) => country.alpha2 === code);
      expect(shapes).toHaveLength(1);
      expect(shapes[0]?.feature.geometry.type).not.toBe("Point");
    }
  });
});

describe("台帳から記録する導線と名前の表示", () => {
  test("沿ドニエストルは追加ボタンを持ち、歴史上の統治体には出さない", () => {
    const region = catalog.regions.find((entry) => entry.id === transnistria);
    const historic = catalog.regions.find((entry) => entry.id === "region:serbian-krajina");
    if (!region || !historic) throw new Error("台帳の対象がない");
    expect(
      renderToStaticMarkup(
        <CatalogDetails
          selection={{ kind: "region", entry: region }}
          onClose={() => {}}
          onSelect={() => {}}
          onRecord={() => {}}
        />,
      ),
    ).toContain("訪問記録に追加");
    expect(
      renderToStaticMarkup(
        <CatalogDetails
          selection={{ kind: "region", entry: historic }}
          onClose={() => {}}
          onSelect={() => {}}
          onRecord={() => {}}
        />,
      ),
    ).not.toContain("訪問記録に追加");
  });
  test("地域の選択を入力へ渡し、記録の一覧に内部IDを表示しない", () => {
    const form = renderToStaticMarkup(
      <RecordForm records={[]} onAdd={() => {}} layout="inline" initialCode={transnistria} />,
    );
    expect(form).toContain('value="沿ドニエストル"');
    expect(form).toContain("国・地域");
    const list = renderToStaticMarkup(
      <RecordList
        records={[{ year: 2024, country: transnistria }]}
        onRemove={() => {}}
        emptyHint=""
      />,
    );
    expect(list).toContain("沿ドニエストル");
    expect(list).not.toContain(transnistria);
  });
});
