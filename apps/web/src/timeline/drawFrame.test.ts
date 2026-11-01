import { describe, expect, test } from "vitest";
import { drawFrame, FRAME_WIDTH, type FrameContext } from "./drawFrame";
import type { MapLayers } from "./mapLayers";
import type { Reel } from "./reel";
import { buildTimeline } from "./timeline";
import { frameAt } from "./timing";
import { COUNTRY_NAMES } from "../records/countryNames";

/** 年の数字の文字サイズ。年の数字だけを描いた文字から取り出すのに使う。 */
const DIGIT_PX = 210;

/** 描いた文字と地図の呼び出しを記録するフェイク。文字幅は 1 文字 = 文字サイズ px として測る。 */
function createRecording() {
  const drawn: { text: string; x: number; px: number; alpha: number }[] = [];
  const maps: {
    key: string;
    y: number;
    visited: string[];
    emphasized: string[];
    strength: number;
  }[] = [];
  const noop = () => {};
  const fontPx = () => Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 10);
  const ctx: FrameContext = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    letterSpacing: "0px",
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    scale: noop,
    translate: noop,
    drawImage: noop,
    rect: noop,
    clip: noop,
    roundRect: noop,
    fillText: (text, x) => {
      drawn.push({ text, x, px: fontPx(), alpha: ctx.globalAlpha });
    },
    measureText: (text) => ({ width: text.length * fontPx() }),
  };
  const layers: MapLayers = {
    draw: (_ctx, rect, key, visited, emphasized, strength) => {
      maps.push({ key, y: rect.y, visited: [...visited], emphasized: [...emphasized], strength });
    },
  };
  return { ctx, layers, drawn, maps };
}

function reelOf(records: Parameters<typeof buildTimeline>[0], pages?: string[][]): Reel {
  const timeline = buildTimeline(records);
  if (!timeline) {
    throw new Error("タイムラインがない");
  }
  return { timeline, summaryPages: pages ?? [["イタリア", "フランス", "日本"]] };
}

function draw(reel: Reel, t: number) {
  const recording = createRecording();
  drawFrame(recording.ctx, FRAME_WIDTH, reel, frameAt(reel, t), recording.layers);
  const { drawn } = recording;
  return {
    ...recording,
    texts: drawn.map((d) => d.text),
    /** 年の数字として描いた文字（めくっている桁は前後の数字が両方入る） */
    digits: drawn.filter((d) => d.px === DIGIT_PX).map((d) => d.text),
  };
}

// 2016 → 2024 は 8 年分なのでめくりは上限の 0.9 秒、2024 → 2025 は 1 年分で 0.3 秒
const reel = reelOf([
  { year: 2016, country: "JP" },
  { year: 2024, country: "FR" },
  { year: 2024, country: "IT" },
  { year: 2024, country: "JP" },
  { year: 2025, country: "JP" },
]);

describe("drawFrame（年のコマ）", () => {
  test("315件でも国・地域の単位と初訪問数が各列に収まる", () => {
    const all = reelOf(COUNTRY_NAMES.map((entry) => ({ year: 2024, country: entry.code })));
    const { drawn } = draw(all, 1.9);
    const unit = drawn.find((entry) => entry.text === "か国・地域");
    const fresh = drawn.find((entry) => entry.text === "+315");
    if (!unit || !fresh) throw new Error("累計または初訪問数が描かれていない");
    expect(unit.x + unit.text.length * unit.px).toBeLessThanOrEqual(500 - 24 + 0.01);
    expect(fresh.x + fresh.text.length * fresh.px).toBeLessThanOrEqual(FRAME_WIDTH - 80 + 0.01);
  });
  test("年、累計、初めて訪れた国の数、国名と再訪した国を描く", () => {
    const { texts, digits } = draw(reel, 2 + 1.9);
    expect(digits).toEqual(["2", "0", "2", "4"]);
    expect(texts).toEqual(
      expect.arrayContaining(["累計", "3", "初めての国・地域", "+2", "イタリア", "フランス"]),
    );
    expect(texts).toEqual(expect.arrayContaining(["再訪", "日本"]));
  });

  test("地図は前の年までの累計を下地にし、その年の国を強調する", () => {
    const { maps } = draw(reel, 2 + 1.9);
    expect(maps).toEqual([
      { key: "year-1", y: 480, visited: ["JP"], emphasized: ["IT", "FR"], strength: 1 },
    ]);
  });

  test("めくりの途中では前の年と次の年の数字を描き、変わらない桁は 1 つだけ描く", () => {
    // 2024 のコマの頭から 0.15 秒（0.3 秒のめくりの半ば）。1 の位だけが 4 → 5 へめくれている
    const { digits } = draw(reel, 4 + 0.15);
    expect(digits.slice(0, 3)).toEqual(["2", "0", "2"]);
    expect(new Set(digits.slice(3))).toEqual(new Set(["4", "5"]));
  });

  test("記録のない年もめくりの途中に現れる", () => {
    // 2016 → 2024 の 8 年分を 0.9 秒でめくる。1 年分は 0.1125 秒なので、0.12 秒では 2017 → 2018 をめくっている
    const { digits } = draw(reel, 2 + 0.12);
    expect(digits).toContain("7");
    expect(digits).toContain("8");
    expect(digits).not.toContain("4");
  });

  test("最初の年はめくらずにフェードインする", () => {
    const { drawn } = draw(reel, 0.1);
    const digits = drawn.filter((d) => d.px === DIGIT_PX);
    expect(digits.map((d) => d.text)).toEqual(["2", "0", "1", "6"]);
    expect(digits[0]?.alpha).toBeLessThan(1);
  });

  test("めくりの途中では地図も累計も前の年のまま（その年の国はまだ塗らない）", () => {
    const { maps, texts } = draw(reel, 2 + 0.5);
    expect(maps).toEqual([
      { key: "year-1:flipping", y: 480, visited: ["JP"], emphasized: [], strength: 0 },
    ]);
    expect(texts).toContain("1");
  });

  test("めくり終わったらその年の国を塗り、強調を始める", () => {
    // めくり（0.9 秒）の直後
    const { maps } = draw(reel, 2 + 0.95);
    expect(maps).toMatchObject([{ key: "year-1", emphasized: ["IT", "FR"] }]);
    expect(maps[0]?.strength).toBeGreaterThan(0);
    expect(maps[0]?.strength).toBeLessThan(1);
  });

  test("めくり終わってから強調と数え上げが進む", () => {
    const { maps, texts } = draw(reel, 2 + 0.9 + 0.6);
    expect(maps[0]?.strength).toBe(1);
    expect(texts).toContain("3");
  });

  test("再訪だけの年は +0 と「再訪」の見出しと再訪した国名を描く", () => {
    const { texts } = draw(reel, 4 + 1.9);
    expect(texts).toEqual(expect.arrayContaining(["+0", "再訪", "日本"]));
  });

  test("同じ時刻なら同じ描画になる", () => {
    const first = draw(reel, 2.3);
    const second = draw(reel, 2.3);
    expect(second.drawn).toEqual(first.drawn);
    expect(second.maps).toEqual(first.maps);
  });
});

describe("drawFrame（まとめのコマ）", () => {
  test("期間、すべての訪問国の地図と国名、累計を描き、+N は描かない", () => {
    const { texts, maps } = draw(reel, 6 + 4);
    expect(texts).toEqual(
      expect.arrayContaining(["2016", "–", "2025", "累計", "3", "イタリア", "フランス", "日本"]),
    );
    expect(texts).not.toContain("初めての国・地域");
    expect(maps).toEqual([
      { key: "summary", y: 480, visited: ["IT", "FR", "JP"], emphasized: [], strength: 1 },
    ]);
  });

  test("期間のダッシュの左右に余白を空ける", () => {
    const { drawn } = draw(reel, 6 + 4);
    const [first, dash, last] = ["2016", "–", "2025"].map((text) =>
      drawn.find((d) => d.text === text),
    );
    // フェイクの文字幅は 1 文字 = 130px。年（4 文字 = 520）の後に 24 空けてダッシュ、ダッシュ（130）の後に 24 空けて年
    expect((dash?.x ?? 0) - (first?.x ?? 0)).toBe(520 + 24);
    expect((last?.x ?? 0) - (dash?.x ?? 0)).toBe(130 + 24);
  });

  test("地図の位置は年のコマと同じ", () => {
    expect(draw(reel, 6 + 1).maps[0]?.y).toBe(draw(reel, 5).maps[0]?.y);
  });

  test("記録が 1 年だけなら期間は 1 つの年で示す", () => {
    const { texts } = draw(reelOf([{ year: 2024, country: "FR" }], [["フランス"]]), 2 + 1);
    expect(texts).toContain("2024");
    expect(texts.some((t) => t.includes("–"))).toBe(false);
  });

  describe("国名が複数ページのとき", () => {
    // 3 年分（6 秒）の後に、2.5 秒 × 2 ページ = 5 秒のまとめ
    const paged = reelOf(
      [
        { year: 2016, country: "JP" },
        { year: 2024, country: "FR" },
        { year: 2024, country: "IT" },
        { year: 2025, country: "JP" },
      ],
      [["イタリア", "フランス"], ["日本"]],
    );

    test("1 ページ目の国名とページの位置を描く", () => {
      const { texts } = draw(paged, 6 + 1);
      expect(texts).toEqual(expect.arrayContaining(["イタリア", "フランス", "1 / 2"]));
      expect(texts).not.toContain("日本");
    });

    test("切り替えの途中は両方のページを描く", () => {
      const { texts } = draw(paged, 6 + 2.5 + 0.2);
      expect(texts).toEqual(expect.arrayContaining(["イタリア", "日本", "2 / 2"]));
    });

    test("最後のページはコマの終わりまで残る", () => {
      const { texts } = draw(paged, 6 + 5);
      expect(texts).toEqual(expect.arrayContaining(["日本", "2 / 2"]));
      expect(texts).not.toContain("イタリア");
    });
  });

  test("1 ページならページの位置は描かない", () => {
    expect(draw(reel, 6 + 4).texts.some((t) => t.includes(" / "))).toBe(false);
  });
});
