import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExportPanel } from "../export/ExportPanel";
import { useVideoExport } from "../export/useVideoExport";
import { loadMapCountries, type MapCountry } from "../map/countries";
import type { VisitRecord } from "../records/visitRecords";
import { createNameTagMeasure, drawFrame, FRAME_HEIGHT, FRAME_WIDTH } from "./drawFrame";
import { currentFrameListIndex, frameListItems } from "./frameList";
import { createMapLayers } from "./mapLayers";
import { buildReel, type Reel } from "./reel";
import { buildTimeline, type Timeline } from "./timeline";
import { Sheet } from "../Sheet";
import { formatTime, frameAt, totalDuration } from "./timing";
import { usePlayback } from "./usePlayback";

type Props = {
  readonly records: readonly VisitRecord[];
  /** PC 幅ではコマの一覧を右のパネルに出す。 */
  readonly wide: boolean;
};

/** 記録から作ったタイムラインを 9:16 で再生するプレビュー画面。 */
export function PreviewScreen({ records, wide }: Props) {
  const timeline = useMemo(() => buildTimeline(records), [records]);
  if (!timeline) {
    return (
      <div className="preview-empty">
        <p>まだ記録がありません。</p>
        <p>「記録」で訪れた国・地域を追加すると、ここで再生できます。</p>
      </div>
    );
  }
  return <TimelinePlayer timeline={timeline} wide={wide} />;
}

function TimelinePlayer({
  timeline,
  wide,
}: {
  readonly timeline: Timeline;
  readonly wide: boolean;
}) {
  // まとめのページ分けは文字幅の計測が要るので、タイムラインが変わったときだけ作り直す
  const reel = useMemo(() => buildReel(timeline, createNameTagMeasure()), [timeline]);
  const duration = totalDuration(reel);
  const playback = usePlayback(duration);
  const frame = frameAt(reel, playback.time);
  const currentIndex = currentFrameListIndex(reel, frame);
  const videoExport = useVideoExport(reel);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const { cancel } = videoExport;
  // 書き出し中にシートを閉じたら、見えないところで重い処理を続けないよう書き出しをキャンセルする
  const closeExportSheet = useCallback(() => {
    cancel();
    setExportSheetOpen(false);
  }, [cancel]);
  const exportPanel = (
    <ExportPanel reel={reel} videoExport={videoExport} onStart={playback.pause} wide={wide} />
  );

  return (
    <div className={wide ? "preview-wide" : "preview-narrow"}>
      <div className="preview-main">
        <FrameCanvas reel={reel} time={playback.time} />
        <div className="preview-controls">
          <button type="button" className="button button--secondary" onClick={playback.restart}>
            最初から再生
          </button>
          <button
            type="button"
            className="button button--primary preview-toggle"
            onClick={playback.playing ? playback.pause : playback.play}
          >
            {playback.playing ? "停止" : "再生"}
          </button>
          <input
            className="preview-seek"
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={playback.time}
            aria-label="再生位置"
            aria-valuetext={`${formatTime(playback.time)} / ${formatTime(duration)}`}
            onChange={(event) => playback.seek(Number(event.target.value))}
          />
          <span className="preview-time">
            {formatTime(playback.time)} / {formatTime(duration)}
          </span>
          {!wide && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setExportSheetOpen(true)}
            >
              書き出す
            </button>
          )}
        </div>
        {!wide && exportSheetOpen && (
          <Sheet title="動画を書き出す" onClose={closeExportSheet}>
            {exportPanel}
          </Sheet>
        )}
      </div>
      {wide && (
        <aside className="preview-panel" aria-label="コマと書き出し">
          <h2 className="panel-heading">コマ</h2>
          <ol className="frame-list">
            {frameListItems(reel).map((item, index) => (
              <li key={item.label}>
                <button
                  type="button"
                  className="frame-item"
                  aria-current={index === currentIndex ? "step" : undefined}
                  onClick={() => playback.seek(item.time)}
                >
                  <span>{item.label}</span>
                  <span className="frame-item-count">{item.count}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="preview-panel-export">{exportPanel}</div>
        </aside>
      )}
    </div>
  );
}

/** 9:16 を保って領域に収まる最大の大きさで、時刻 time のコマを描く。 */
function FrameCanvas({ reel, time }: { readonly reel: Reel; readonly time: number }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countries, setCountries] = useState<readonly MapCountry[]>();
  const [cssWidth, setCssWidth] = useState(0);
  const layers = useMemo(() => (countries ? createMapLayers(countries) : undefined), [countries]);

  useEffect(() => {
    let cancelled = false;
    void loadMapCountries().then((loaded) => {
      if (!cancelled) {
        setCountries(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        const { width, height } = entry.contentRect;
        setCssWidth(Math.floor(Math.min(width, (height * FRAME_WIDTH) / FRAME_HEIGHT)));
      }
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !layers || cssWidth === 0) {
      return;
    }
    // 高 DPI 画面でぼやけないよう、内部解像度は devicePixelRatio 倍にする
    const width = Math.round(cssWidth * (window.devicePixelRatio || 1));
    const height = Math.round((width * FRAME_HEIGHT) / FRAME_WIDTH);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    drawFrame(ctx, width, reel, frameAt(reel, time), layers);
  }, [reel, time, layers, cssWidth]);

  return (
    <div ref={stageRef} className="preview-stage">
      <canvas
        ref={canvasRef}
        className="preview-canvas"
        style={{ width: cssWidth, height: (cssWidth * FRAME_HEIGHT) / FRAME_WIDTH }}
      >
        訪問した国・地域を年ごとに積み上げていくアニメーション
      </canvas>
    </div>
  );
}
