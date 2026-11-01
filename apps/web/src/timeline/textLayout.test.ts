import { describe, expect, test } from "vitest";
import { layoutPageTags, layoutYearTags, paginateNames, type Tag } from "./textLayout";

/**
 * 1 文字 = 幅 100 として測るフェイク（テストの文字はすべて BMP 内なので UTF-16 の長さで数える）。
 * タグの幅は 4 文字の国名で 400 + 余白 44 = 444 になり、幅 920 の行に 2 つ（444 + 14 + 444 = 902）まで並ぶ。
 */
const measure = (text: string) => text.length * 100;

function summary(tags: readonly Tag[]) {
  return tags.map(({ text, kind, row }) => `${row}:${kind}:${text}`);
}

describe("layoutYearTags", () => {
  test("初めて訪れた国をタグとして行に詰めて並べる", () => {
    expect(layoutYearTags(["AAAA", "BBBB", "CCCC"], [], measure)).toEqual([
      { text: "AAAA", kind: "fresh", x: 0, row: 0, width: 444 },
      { text: "BBBB", kind: "fresh", x: 458, row: 0, width: 444 },
      { text: "CCCC", kind: "fresh", x: 0, row: 1, width: 444 },
    ]);
  });

  test("収まるときは初めて訪れた国の後ろに「再訪」の見出しと再訪した国を並べる", () => {
    expect(summary(layoutYearTags(["AAAA", "BBBB"], ["CCCC"], measure))).toEqual([
      "0:fresh:AAAA",
      "0:fresh:BBBB",
      "1:label:再訪",
      "1:revisit:CCCC",
    ]);
  });

  test("再訪まで収まらないときは再訪をまるごと省く", () => {
    // 初めて訪れた国 5 つで 3 行目に 1 つ。見出しは入るが、再訪した国が 4 行目にはみ出す
    const fresh = ["AAAA", "BBBB", "CCCC", "DDDD", "EEEE"];
    expect(summary(layoutYearTags(fresh, ["RRRR", "SSSS"], measure))).toEqual(
      fresh.map((name, index) => `${Math.floor(index / 2)}:fresh:${name}`),
    );
  });

  test("初めて訪れた国も収まらない分は「ほか N か国・地域」にまとめる", () => {
    const fresh = ["AAAA", "BBBB", "CCCC", "DDDD", "EEEE", "FFFF", "GGGG"];
    // 「ほか N か国・地域」（7 文字 = 744）は国名と同じ行に入らないので、3 行目は「ほか 3 か国・地域」だけになる
    expect(summary(layoutYearTags(fresh, ["RRRR"], measure))).toEqual([
      "0:fresh:AAAA",
      "0:fresh:BBBB",
      "1:fresh:CCCC",
      "1:fresh:DDDD",
      "2:more:ほか 3 か国・地域",
    ]);
  });

  test("再訪だけの年は「再訪」の見出しと再訪した国を並べる", () => {
    expect(summary(layoutYearTags([], ["AAAA", "BBBB"], measure))).toEqual([
      "0:label:再訪",
      "0:revisit:AAAA",
      "1:revisit:BBBB",
    ]);
  });

  test("国がなければタグもない", () => {
    expect(layoutYearTags([], [], measure)).toEqual([]);
  });
});

describe("paginateNames / layoutPageTags", () => {
  const names = Array.from({ length: 13 }, (_, index) => String.fromCharCode(65 + index).repeat(4));

  test("表示枠（3 行）に収まる単位で先頭からページに分ける", () => {
    const pages = paginateNames(names, measure);
    expect(pages.map((page) => page.length)).toEqual([6, 6, 1]);
    // すべての国がちょうど 1 回ずつ、元の順で現れる
    expect(pages.flat()).toEqual(names);
  });

  test("分けたページは表示枠に収まる", () => {
    for (const page of paginateNames(names, measure)) {
      const tags = layoutPageTags(page, measure);
      expect(tags.map((tag) => tag.text)).toEqual(page);
      expect(Math.max(...tags.map((tag) => tag.row))).toBeLessThan(3);
    }
  });

  test("1 ページに収まれば 1 ページ", () => {
    expect(paginateNames(["AAAA", "BBBB"], measure)).toEqual([["AAAA", "BBBB"]]);
  });
});
