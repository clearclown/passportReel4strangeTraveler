import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import CatalogScreen from "./CatalogScreen";
import { CatalogDetails, RegionDetails } from "./CatalogDetails";
import { catalog, regionsById, reviewCounts } from "./catalog";
import { CatalogDataLicenses } from "../licenses/CatalogDataLicenses";

describe("台帳の表示", () => {
  test("原本の件数・調査状況を表示し、最初の50地域だけを一覧にする", () => {
    const html = renderToStaticMarkup(<CatalogScreen />);
    expect(html).toContain(`>${catalog.regions.length}</strong>`);
    expect(html).toContain("5,070");
    expect(html).toContain(`調査完了 ${reviewCounts().complete}`);
    expect(html.match(/aria-label="[^"]+の詳細"/g)).toHaveLength(50);
    expect(html).toContain("条件を解除");
    expect(html).toContain("国家承認や訪問先への採用を意味しません");
  });
  test("地域の根拠・出典・未確認値を表示し、内部識別子を見出しにしない", () => {
    const region = regionsById.get("region:gagauzia");
    expect(region).toBeDefined();
    if (!region) return;
    const html = renderToStaticMarkup(<RegionDetails region={region} />);
    expect(html).toContain("資料に記載された内容");
    expect(html).toContain("訪問先として記録できます");
    expect(html).toContain("未入力");
    expect(html).toContain("未確認事項");
    expect(html).toContain("対象時点:");
    expect(html).toContain("記述の確認日:");
    expect(html).toContain("出典と資料の制約");
    expect(html).not.toContain(region.id);
    expect(html).toContain('rel="noopener noreferrer"');
  });
  test("古い行政区画の名称と未確認理由を残す", () => {
    const entry = catalog.subdivisions.find((row) => row.code === "PH-14");
    expect(entry).toBeDefined();
    if (!entry) return;
    const html = renderToStaticMarkup(
      <CatalogDetails
        selection={{ kind: "subdivision", entry }}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain("PH-14");
    expect(html).toContain(entry.nameOriginal);
    expect(html).toContain("バンサモロ");
    expect(html).toContain("未確認");
  });
  test("手動取り込みのデータの固定版とMIT許諾文を配布する", () => {
    const html = renderToStaticMarkup(<CatalogDataLicenses />);
    expect(html).toContain("4.4.0");
    expect(html).toContain("7.14.0");
    expect(html.match(/Permission is hereby granted/g)).toHaveLength(2);
    expect(html).toContain("THE SOFTWARE IS PROVIDED");
    expect(html).toContain("固定版の取得元");
  });
});
