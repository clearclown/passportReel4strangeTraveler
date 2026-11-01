/**
 * 国名のタグの寸法（コマの基準 1080×1920 に対する px）。
 * 年のコマとまとめのコマのページ分けで同じ寸法を使い、ページ分けした国名が描くときにも必ず収まるようにする。
 */
export const NAME_TAGS = {
  fontSize: 38,
  maxWidth: 920,
  maxRows: 3,
  /** タグの左右の余白（片側） */
  paddingX: 22,
  /** タグとタグの間（横・縦とも） */
  gap: 14,
} as const;

/** 文字列の幅を測る。描画先のフォントに依存するため呼び出し側から受け取る。 */
export type Measure = (text: string) => number;

/**
 * fresh：その年に初めて訪れた国、revisit：再訪した国、more：「ほか N か国・地域」、label：「再訪」の見出し（枠なし）。
 */
type TagKind = "fresh" | "revisit" | "more" | "label";

export type Tag = {
  readonly text: string;
  readonly kind: TagKind;
  /** 行の左端からの位置 */
  readonly x: number;
  readonly row: number;
  readonly width: number;
};

type TagToken = { readonly text: string; readonly kind: TagKind };

const REVISIT_LABEL: TagToken = { text: "再訪", kind: "label" };

/** タグを行に詰めて並べる。最大行数に収まらなければ undefined。 */
function layoutTags(tokens: readonly TagToken[], measure: Measure): Tag[] | undefined {
  const tags: Tag[] = [];
  let x = 0;
  let row = 0;
  for (const token of tokens) {
    const width =
      token.kind === "label" ? measure(token.text) : measure(token.text) + NAME_TAGS.paddingX * 2;
    // 1 つで幅を超えるタグは折り返せないので、行頭にそのまま置く
    if (x > 0 && x + width > NAME_TAGS.maxWidth) {
      row += 1;
      x = 0;
    }
    tags.push({ ...token, x, row, width });
    x += width + NAME_TAGS.gap;
  }
  return row < NAME_TAGS.maxRows ? tags : undefined;
}

/** 収まるところまで国名を減らし、残りを「ほか N か国・地域」のタグにまとめる。 */
function layoutWithRest(
  names: readonly string[],
  kind: "fresh" | "revisit",
  measure: Measure,
): Tag[] {
  const head = kind === "revisit" ? [REVISIT_LABEL] : [];
  for (let shown = names.length; shown > 0; shown -= 1) {
    const rest = names.length - shown;
    const tags = layoutTags(
      [
        ...head,
        ...names.slice(0, shown).map((text) => ({ text, kind })),
        ...(rest > 0 ? [{ text: `ほか ${rest} か国・地域`, kind: "more" as const }] : []),
      ],
      measure,
    );
    if (tags) {
      return tags;
    }
  }
  return (
    layoutTags([...head, { text: `ほか ${names.length} か国・地域`, kind: "more" }], measure) ?? []
  );
}

/**
 * 年のコマの国名のタグ。初めて訪れた国の後ろに「再訪」の見出しと再訪した国を並べる。
 * すべてが表示枠に収まらなければ再訪はまるごと省き、初めて訪れた国だけを並べる（収まらない分は「ほか N か国・地域」）。
 * 初めて訪れた国がない年は、再訪した国を同じように並べる。
 */
export function layoutYearTags(
  fresh: readonly string[],
  revisited: readonly string[],
  measure: Measure,
): Tag[] {
  if (fresh.length === 0) {
    return revisited.length > 0 ? layoutWithRest(revisited, "revisit", measure) : [];
  }
  if (revisited.length > 0) {
    const all = layoutTags(
      [
        ...fresh.map((text) => ({ text, kind: "fresh" as const })),
        REVISIT_LABEL,
        ...revisited.map((text) => ({ text, kind: "revisit" as const })),
      ],
      measure,
    );
    if (all) {
      return all;
    }
  }
  return layoutWithRest(fresh, "fresh", measure);
}

function pageTokens(names: readonly string[]): TagToken[] {
  return names.map((text) => ({ text, kind: "fresh" }));
}

/**
 * 1 ページ分の国名をタグとして並べる。
 * ページは paginateNames で表示枠に収まるように分けてあるので、同じ計測なら必ず収まる。
 */
export function layoutPageTags(names: readonly string[], measure: Measure): Tag[] {
  return layoutTags(pageTokens(names), measure) ?? [];
}

/** まとめのコマの国名を、表示枠に収まる単位で先頭からページに分ける。 */
export function paginateNames(names: readonly string[], measure: Measure): string[][] {
  const pages: string[][] = [[]];
  for (const name of names) {
    const page = pages.at(-1) ?? [];
    // 1 つで表示枠を超える国名も、空のページには置く（ページが無限に増えないように）
    if (page.length === 0 || layoutTags(pageTokens([...page, name]), measure)) {
      page.push(name);
    } else {
      pages.push([name]);
    }
  }
  return pages;
}
