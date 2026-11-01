import { MAP_ASPECT_RATIO } from "../map/drawWorldMap";
import { countryName } from "../records/countryNames";
import type { MapLayers } from "./mapLayers";
import type { Reel } from "./reel";
import { layoutPageTags, layoutYearTags, type Measure, NAME_TAGS, type Tag } from "./textLayout";
import {
  EMPHASIS_SECONDS,
  flipSeconds,
  type FrameState,
  frameStartTimes,
  LIST_FADE_SECONDS,
  PAGE_TRANSITION_SECONDS,
  summaryPageAt,
  TEXT_FADE_SECONDS,
  totalDuration,
} from "./timing";

/** コマの基準の大きさ。すべての配置と文字の大きさはこの座標系で決め、表示する幅に合わせて拡大・縮小する。 */
export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1920;

/**
 * コマの配色。Canvas からは CSS 変数を読めないため値を直接持つ。
 * docs/design-guidelines.md のデザイントークン（--bg、--surface-2、--text、--muted、--line、--accent、--accent-strong）と一致させる。
 */
const COLORS = {
  bg: "#0b1019",
  surface2: "#1a2233",
  text: "#e7eaf0",
  muted: "#8d96aa",
  line: "#243047",
  accent: "#f2a93b",
  accentStrong: "#ffd27a",
} as const;

/** CSS の --font-sans と同じ指定。端末のサンセリフ体で描く。 */
const FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", sans-serif';

const PADDING_X = 80;
const TEXT_WIDTH = FRAME_WIDTH - PADDING_X * 2;
const MAP_HEIGHT = FRAME_WIDTH / MAP_ASPECT_RATIO;

/**
 * 年のコマとまとめのコマで共通の配置。コマが切り替わっても地図・国数・国名の位置がずれないよう、同じ値を使う。
 * 年は 1 桁ずつ固定幅のセルの中央に描き、数字の幅の違いで桁の位置が揺れないようにする。
 */
const LAYOUT = {
  digitTop: 196,
  digitHeight: 236,
  digitWidth: 132,
  digitFontSize: 210,
  mapY: 480,
  statsY: 1330,
  /** 国数の行の区切り線と、右側（+N）の左端 */
  statsDividerX: 500,
  statsRightX: 560,
  namesY: 1540,
  progressY: 1790,
} as const;

/**
 * ページを切り替えるときに縦へ動かす量。
 * アニメーションの長さは、コマの一覧の移動先の計算にも使うため timing.ts に置く。
 */
const PAGE_SHIFT = 60;

export type FrameContext = Parameters<MapLayers["draw"]>[0] &
  Pick<
    CanvasRenderingContext2D,
    | "font"
    | "textAlign"
    | "textBaseline"
    | "globalAlpha"
    | "letterSpacing"
    | "fillText"
    | "scale"
    | "rect"
    | "clip"
    | "roundRect"
  > & {
    /** 文字の配置に使う。使うのは幅だけなので、テストのフェイクでも用意しやすいよう幅だけを求める。 */
    measureText: (text: string) => { readonly width: number };
  };

function progressOf(elapsed: number, seconds: number): number {
  return Math.min(Math.max(elapsed / seconds, 0), 1);
}

function easeOut(x: number): number {
  return 1 - (1 - x) ** 3;
}

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}

function font(weight: number, px: number): string {
  return `${weight} ${px}px ${FONT_FAMILY}`;
}

const NAME_TAG_FONT = font(500, NAME_TAGS.fontSize);

/**
 * 国名のタグと同じフォントで文字幅を測る関数を作る。まとめのコマのページ分け（buildReel）に使う。
 * 描画と同じフォント指定で測るので、ページ分けした国名は描くときにも表示枠に収まる。
 */
export function createNameTagMeasure(): Measure {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D コンテキストを取得できない");
  }
  ctx.font = NAME_TAG_FONT;
  return (text) => ctx.measureText(text).width;
}

function setText(ctx: FrameContext, weight: number, px: number, color: string) {
  ctx.font = font(weight, px);
  ctx.fillStyle = color;
  ctx.letterSpacing = "0px";
}

function drawBrand(ctx: FrameContext) {
  setText(ctx, 700, 30, COLORS.muted);
  ctx.letterSpacing = "8px";
  ctx.fillText("PASSPORT REEL", PADDING_X, 150);
  ctx.letterSpacing = "0px";
}

function digitX(position: number): number {
  return PADDING_X + position * LAYOUT.digitWidth;
}

const DIGIT_MIDDLE = LAYOUT.digitTop + LAYOUT.digitHeight / 2;

function drawDigitText(ctx: FrameContext, digit: number, x: number) {
  setText(ctx, 800, LAYOUT.digitFontSize, COLORS.text);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(digit), x + LAYOUT.digitWidth / 2, DIGIT_MIDDLE);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/**
 * 数字の上半分か下半分を、中央線を軸に縦へ scaleY 倍して描く。
 * 背景色で塗ってから描くので、下に描いてある数字を隠せる（枠は見えない）。
 * 上半分は 1px 長くして下半分に重ね、縮小表示で境目に隙間（横線）が出ないようにする。
 * shade は文字の明るさ（1 で通常）。めくれて寝ている間は暗くする。
 */
function drawDigitHalf(
  ctx: FrameContext,
  digit: number,
  x: number,
  half: "top" | "bottom",
  scaleY: number,
  shade: number,
) {
  if (scaleY <= 0) {
    return;
  }
  const halfHeight = LAYOUT.digitHeight / 2;
  const y = half === "top" ? LAYOUT.digitTop : DIGIT_MIDDLE;
  const height = half === "top" ? halfHeight + 1 : halfHeight;
  ctx.save();
  ctx.translate(0, DIGIT_MIDDLE);
  ctx.scale(1, scaleY);
  ctx.translate(0, -DIGIT_MIDDLE);
  ctx.beginPath();
  ctx.rect(x, y, LAYOUT.digitWidth, height);
  ctx.clip();
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(x, y, LAYOUT.digitWidth, height);
  ctx.globalAlpha *= shade;
  drawDigitText(ctx, digit, x);
  ctx.restore();
}

/**
 * 1 桁を描く。from から to へ、p（0〜1）だけめくれた状態にする。
 * Canvas には 3D の回転がないため、前半は前の数字の上半分が中央線へ縮み、後半は次の数字の下半分が中央線から伸びることで
 * めくりを表す。止まっている桁は上下に分けずに 1 回で描く（分けると境目に横線が出るため）。
 */
function drawDigit(ctx: FrameContext, position: number, from: number, to: number, p: number) {
  const x = digitX(position);
  if (from === to || p >= 1) {
    drawDigitText(ctx, to, x);
    return;
  }
  drawDigitHalf(ctx, to, x, "top", 1, 1);
  drawDigitHalf(ctx, from, x, "bottom", 1, 1);
  if (p < 0.5) {
    const scaleY = 1 - easeInOut(p * 2);
    drawDigitHalf(ctx, from, x, "top", scaleY, 0.45 + 0.55 * scaleY);
  } else {
    const scaleY = easeInOut((p - 0.5) * 2);
    drawDigitHalf(ctx, to, x, "bottom", scaleY, 0.45 + 0.55 * scaleY);
  }
}

/**
 * 年の数字を描く。めくっている間（elapsed < flip）は、前の年から 1 年ずつ、記録のない年も含めてめくる。
 * めくりの時間は年の差の回数に均等に割り当て、変わる桁だけをめくる。
 */
function drawYear(
  ctx: FrameContext,
  previousYear: number | undefined,
  year: number,
  elapsed: number,
  flip: number,
) {
  let from = year;
  let to = year;
  let p = 1;
  if (previousYear !== undefined && elapsed < flip) {
    const steps = (elapsed / flip) * (year - previousYear);
    const step = Math.floor(steps);
    from = previousYear + step;
    to = from + 1;
    p = steps - step;
  }
  const fromDigits = digitsOf(from);
  digitsOf(to).forEach((digit, position) => {
    drawDigit(ctx, position, fromDigits[position] ?? digit, digit, p);
  });
}

/** 年（0 以上の整数）を、上の桁から順に 1 桁ずつの数字に分ける。 */
function digitsOf(year: number): number[] {
  const digits: number[] = [];
  let rest = year;
  do {
    digits.unshift(rest % 10);
    rest = Math.floor(rest / 10);
  } while (rest > 0);
  return digits;
}

function drawStatLabel(ctx: FrameContext, label: string, x: number) {
  setText(ctx, 600, 30, COLORS.muted);
  ctx.fillText(label, x, LAYOUT.statsY + 32);
}

const STAT_BASELINE = LAYOUT.statsY + 150;

/**
 * 国数の行。左に累計の国数、年のコマでは右に「初めて訪れた国 +N」を並べる。
 * まとめのコマでは右側がなくなるだけで、累計の位置は年のコマと変わらない。
 */
function drawStats(
  ctx: FrameContext,
  cumulative: number,
  newCount: number | undefined,
  alpha: number,
) {
  drawStatLabel(ctx, "累計", PADDING_X);
  const unit = "か国・地域";
  setText(ctx, 600, 32, COLORS.muted);
  const unitWidth = ctx.measureText(unit).width;
  setText(ctx, 800, 120, COLORS.accent);
  const number = String(cumulative);
  // 地域を含む長い単位と3桁以上の累計が、右の初訪問数へ重ならないようにする。
  const maxNumberWidth = LAYOUT.statsDividerX - PADDING_X - unitWidth - 38;
  const measuredNumberWidth = ctx.measureText(number).width;
  if (measuredNumberWidth > maxNumberWidth)
    setText(ctx, 800, (120 * maxNumberWidth) / measuredNumberWidth, COLORS.accent);
  ctx.fillText(number, PADDING_X, STAT_BASELINE);
  const numberWidth = ctx.measureText(number).width;
  setText(ctx, 600, 32, COLORS.muted);
  ctx.fillText(unit, PADDING_X + numberWidth + 14, STAT_BASELINE);

  if (newCount === undefined) {
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS.line;
  ctx.fillRect(LAYOUT.statsDividerX, LAYOUT.statsY + 12, 2, 150);
  drawStatLabel(ctx, "初めての国・地域", LAYOUT.statsRightX);
  setText(ctx, 800, 120, COLORS.accentStrong);
  const fresh = `+${newCount}`;
  const freshWidth = ctx.measureText(fresh).width;
  const available = FRAME_WIDTH - PADDING_X - LAYOUT.statsRightX;
  if (freshWidth > available)
    setText(ctx, 800, (120 * available) / freshWidth, COLORS.accentStrong);
  ctx.fillText(fresh, LAYOUT.statsRightX, STAT_BASELINE);
  ctx.globalAlpha = 1;
}

const TAG_HEIGHT = NAME_TAGS.fontSize + 30;

/** 国名のタグを描く。再訪と「ほか N か国・地域」は枠線だけの控えめなタグ、「再訪」の見出しは枠なしの文字にする。 */
function drawTags(ctx: FrameContext, tags: readonly Tag[]) {
  for (const tag of tags) {
    const x = PADDING_X + tag.x;
    const y = LAYOUT.namesY + tag.row * (TAG_HEIGHT + NAME_TAGS.gap);
    const quiet = tag.kind !== "fresh";
    if (tag.kind !== "label") {
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, tag.width - 2, TAG_HEIGHT - 2, TAG_HEIGHT / 2);
      if (quiet) {
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = COLORS.surface2;
        ctx.fill();
      }
    }
    ctx.font = tag.kind === "label" ? font(700, NAME_TAGS.fontSize) : NAME_TAG_FONT;
    ctx.fillStyle = quiet ? COLORS.muted : COLORS.text;
    ctx.textAlign = tag.kind === "label" ? "left" : "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tag.text, tag.kind === "label" ? x : x + tag.width / 2, y + TAG_HEIGHT / 2);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function measureTag(ctx: FrameContext): Measure {
  ctx.font = NAME_TAG_FONT;
  return (text) => ctx.measureText(text).width;
}

/** 全コマ中の再生位置を示す進捗バー。 */
function drawProgress(ctx: FrameContext, position: number) {
  ctx.fillStyle = COLORS.line;
  ctx.fillRect(PADDING_X, LAYOUT.progressY, TEXT_WIDTH, 8);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(PADDING_X, LAYOUT.progressY, TEXT_WIDTH * position, 8);
}

function mapRect() {
  return { x: 0, y: LAYOUT.mapY, width: FRAME_WIDTH, height: MAP_HEIGHT };
}

function drawYearFrame(
  ctx: FrameContext,
  reel: Reel,
  index: number,
  elapsed: number,
  layers: MapLayers,
  pixelScale: number,
) {
  const { timeline } = reel;
  const entry = timeline.years[index];
  if (!entry) {
    return;
  }
  const previous = timeline.years[index - 1];
  const before = previous?.cumulative ?? new Set<string>();
  const flip = flipSeconds(timeline, index);
  // 強調・数え上げ・文字のフェードインは、年をめくり終わってから始める
  const afterFlip = elapsed - flip;
  const fade = easeOut(progressOf(afterFlip, TEXT_FADE_SECONDS));
  const growth = easeOut(progressOf(afterFlip, EMPHASIS_SECONDS));

  // 強調は強さ 0 でもハイライト色で塗るため、めくっている間はその年の国を渡さず、前の年までの地図にしておく。
  // 描く絵が違うので、地図のキャッシュもめくっている間とその後で分ける
  const flipping = afterFlip < 0;
  layers.draw(
    ctx,
    mapRect(),
    flipping ? `year-${index}:flipping` : `year-${index}`,
    before,
    flipping ? new Set<string>() : new Set(entry.newCountries),
    growth,
    pixelScale,
  );

  drawBrand(ctx);
  // 最初の年はめくらずにフェードインする
  ctx.globalAlpha = previous ? 1 : fade;
  drawYear(ctx, previous?.year, entry.year, elapsed, flip);
  ctx.globalAlpha = 1;

  const count = Math.round(before.size + (entry.cumulative.size - before.size) * growth);
  drawStats(ctx, count, entry.newCountries.length, fade);

  ctx.globalAlpha = fade;
  drawTags(
    ctx,
    layoutYearTags(
      entry.newCountries.map(countryName),
      entry.revisitedCountries.map(countryName),
      measureTag(ctx),
    ),
  );
  ctx.globalAlpha = 1;

  drawProgress(ctx, positionOf(reel, index, elapsed));
}

/** まとめのコマの国名の 1 ページを、透明度 alpha・縦のずれ dy で描く。 */
function drawPage(ctx: FrameContext, names: readonly string[], alpha: number, dy: number) {
  ctx.save();
  ctx.translate(0, dy);
  ctx.globalAlpha = alpha;
  drawTags(ctx, layoutPageTags(names, measureTag(ctx)));
  ctx.restore();
}

/**
 * まとめのコマの国名。1 ページ目はフェードインし、2 ページ目以降は前のページが上へ抜けながら消え、
 * 次のページが下から入る。ページが複数あれば、国数の行の右端にページの位置を示す。
 */
function drawSummaryNames(ctx: FrameContext, reel: Reel, elapsed: number) {
  const { summaryPages } = reel;
  const { page, elapsed: inPage } = summaryPageAt(reel, elapsed);
  const current = summaryPages[page] ?? [];
  const previous = summaryPages[page - 1];
  if (previous === undefined) {
    drawPage(ctx, current, easeOut(progressOf(inPage, LIST_FADE_SECONDS)), 0);
  } else {
    const p = easeInOut(progressOf(inPage, PAGE_TRANSITION_SECONDS));
    if (p < 1) {
      drawPage(ctx, previous, 1 - p, -PAGE_SHIFT * p);
    }
    drawPage(ctx, current, p, PAGE_SHIFT * (1 - p));
  }

  if (summaryPages.length > 1) {
    setText(ctx, 600, 28, COLORS.muted);
    ctx.textAlign = "right";
    ctx.fillText(`${page + 1} / ${summaryPages.length}`, PADDING_X + TEXT_WIDTH, STAT_BASELINE);
    ctx.textAlign = "left";
  }
}

/** 期間のダッシュの左右の余白。太字の大きな数字ではフォントのままだとダッシュが数字に詰まって見えるため空ける。 */
const PERIOD_DASH_GAP = 24;

/** 期間（例：2016 – 2024）を、年の数字と同じ領域の縦の中央に描く。年が 1 つなら年だけを描く。 */
function drawPeriod(ctx: FrameContext, firstYear: number, lastYear: number) {
  setText(ctx, 800, 130, COLORS.text);
  ctx.textBaseline = "middle";
  const parts = firstYear === lastYear ? [`${firstYear}`] : [`${firstYear}`, "–", `${lastYear}`];
  let x = PADDING_X - 4;
  for (const part of parts) {
    ctx.fillText(part, x, DIGIT_MIDDLE);
    x += ctx.measureText(part).width + PERIOD_DASH_GAP;
  }
  ctx.textBaseline = "alphabetic";
}

function drawSummaryFrame(
  ctx: FrameContext,
  reel: Reel,
  elapsed: number,
  layers: MapLayers,
  pixelScale: number,
) {
  const { firstYear, lastYear, countries } = reel.timeline.summary;
  drawBrand(ctx);
  drawPeriod(ctx, firstYear, lastYear);

  layers.draw(ctx, mapRect(), "summary", new Set(countries), new Set(), 1, pixelScale);
  drawStats(ctx, countries.length, undefined, 1);
  drawSummaryNames(ctx, reel, elapsed);
  drawProgress(ctx, positionOf(reel, reel.timeline.years.length, elapsed));
}

/** 全体の長さに対する再生位置（0〜1）。 */
function positionOf(reel: Reel, frameIndex: number, elapsed: number): number {
  const start = frameStartTimes(reel)[frameIndex] ?? 0;
  return Math.min((start + elapsed) / totalDuration(reel), 1);
}

/**
 * 1 コマを描く。プレビューと動画の書き出しで共通に使う。
 * 描く内容は引数だけで決まり、同じ frame なら必ず同じ絵になる。
 * width は描画先の幅（実ピクセル）で、基準の 1080×1920 の座標系をその幅に合わせて縮小・拡大する。
 */
export function drawFrame(
  ctx: FrameContext,
  width: number,
  reel: Reel,
  frame: FrameState,
  layers: MapLayers,
): void {
  const scale = width / FRAME_WIDTH;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  if (frame.kind === "year") {
    drawYearFrame(ctx, reel, frame.index, frame.elapsed, layers, scale);
  } else {
    drawSummaryFrame(ctx, reel, frame.elapsed, layers, scale);
  }
  ctx.restore();
}
