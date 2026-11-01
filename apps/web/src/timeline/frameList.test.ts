import { describe, expect, test } from "vitest";
import { currentFrameListIndex, frameListItems } from "./frameList";
import type { Reel } from "./reel";
import { buildTimeline } from "./timeline";
import { frameAt, frameJumpTimes } from "./timing";

/** 2016 年に 2 か国・地域、2019 年に 1 か国・地域。まとめの国名は pages のとおりにページ分けされているものとする。 */
function reelOf(pages: readonly (readonly string[])[]): Reel {
  const timeline = buildTimeline([
    { year: 2016, country: "JP" },
    { year: 2016, country: "KR" },
    { year: 2019, country: "FR" },
  ]);
  if (!timeline) {
    throw new Error("タイムラインがない");
  }
  return { timeline, summaryPages: pages };
}

describe("frameListItems", () => {
  test("年のコマはその年に初めて訪れた国の数を示す", () => {
    const items = frameListItems(reelOf([["日本", "韓国", "フランス"]]));
    expect(items.slice(0, 2).map(({ label, count }) => ({ label, count }))).toEqual([
      { label: "2016", count: "+2" },
      { label: "2019", count: "+1" },
    ]);
  });

  test("まとめが 1 ページなら、まとめは 1 項目で累計の国数だけを示す", () => {
    const items = frameListItems(reelOf([["日本", "韓国", "フランス"]]));
    expect(items).toHaveLength(3);
    expect(items[2]).toMatchObject({ label: "まとめ", count: "3 か国・地域" });
  });

  test("まとめが複数ページなら、ページごとに累計の国数とそのページの国の範囲を示す", () => {
    const items = frameListItems(reelOf([["日本", "韓国"], ["フランス"]]));
    expect(items.slice(2).map(({ label, count }) => ({ label, count }))).toEqual([
      { label: "まとめ 1/2", count: "3 か国・地域（1–2）" },
      // 1 か国・地域だけのページは範囲にせず番号だけを示す
      { label: "まとめ 2/2", count: "3 か国・地域（3）" },
    ]);
  });

  test("移動先はコマの一覧の移動先の時刻", () => {
    const reel = reelOf([["日本", "韓国"], ["フランス"]]);
    expect(frameListItems(reel).map((item) => item.time)).toEqual(frameJumpTimes(reel));
  });
});

describe("currentFrameListIndex", () => {
  const reel = reelOf([["日本", "韓国"], ["フランス"]]);

  test("年のコマはその年の項目", () => {
    expect(currentFrameListIndex(reel, frameAt(reel, 2.5))).toBe(1);
  });

  test("まとめのコマは表示中のページの項目", () => {
    expect(currentFrameListIndex(reel, frameAt(reel, 4.1))).toBe(2);
    expect(currentFrameListIndex(reel, frameAt(reel, 4 + 2.6))).toBe(3);
  });

  test("各項目の移動先では、その項目が表示中になる", () => {
    frameListItems(reel).forEach((item, index) => {
      expect(currentFrameListIndex(reel, frameAt(reel, item.time))).toBe(index);
    });
  });
});
