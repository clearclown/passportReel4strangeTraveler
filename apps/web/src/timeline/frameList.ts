import type { Reel } from "./reel";
import { type FrameState, frameJumpTimes, summaryPageAt } from "./timing";

/** プレビューのコマの一覧の 1 項目。 */
export type FrameListItem = {
  readonly label: string;
  readonly count: string;
  /** 選んだときの移動先の時刻（秒） */
  readonly time: number;
};

/**
 * コマの一覧の項目（年のコマ、続いてまとめのコマ）。
 * まとめの国名が複数ページに分かれるときは、ページごとに項目を分け、コマの中のページ番号と同じ「1/2」の表記と、
 * そのページに載る国の番号の範囲を示す。
 */
export function frameListItems(reel: Reel): readonly FrameListItem[] {
  const { timeline, summaryPages } = reel;
  const jumps = frameJumpTimes(reel);
  const years = timeline.years.map((entry, index) => ({
    label: `${entry.year}`,
    count: `+${entry.newCountries.length}`,
    time: jumps[index] ?? 0,
  }));
  const total = `${timeline.summary.countries.length} か国・地域`;
  let first = 1;
  const pages = summaryPages.map((names, page) => {
    const last = first + names.length - 1;
    const range = last === first ? `${first}` : `${first}–${last}`;
    first += names.length;
    const time = jumps[timeline.years.length + page] ?? 0;
    return summaryPages.length === 1
      ? { label: "まとめ", count: total, time }
      : { label: `まとめ ${page + 1}/${summaryPages.length}`, count: `${total}（${range}）`, time };
  });
  return [...years, ...pages];
}

/** 表示中のコマに当たる、コマの一覧の項目の位置。まとめのコマでは表示中のページの項目になる。 */
export function currentFrameListIndex(reel: Reel, frame: FrameState): number {
  return frame.kind === "year"
    ? frame.index
    : reel.timeline.years.length + summaryPageAt(reel, frame.elapsed).page;
}
