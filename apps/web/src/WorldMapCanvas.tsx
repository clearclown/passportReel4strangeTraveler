import { useEffect, useRef, useState } from "react";
import { loadMapCountries, type MapCountry } from "./map/countries";
import { drawWorldMap, type MapSize } from "./map/drawWorldMap";

type Props = { readonly visited: ReadonlySet<string> };

/** 親要素いっぱいに広がる世界地図。地図は縦横比を保って中央に置かれ、余白は海の色になる。 */
export function WorldMapCanvas({ visited }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countries, setCountries] = useState<readonly MapCountry[]>();
  const [cssSize, setCssSize] = useState<MapSize>({ width: 0, height: 0 });

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
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setCssSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !countries || cssSize.width === 0 || cssSize.height === 0) {
      return;
    }
    // 高 DPI 画面でぼやけないよう、内部解像度は devicePixelRatio 倍にして座標系だけ CSS ピクセルに合わせる
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssSize.width * dpr);
    canvas.height = Math.round(cssSize.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWorldMap(ctx, cssSize, countries, visited);
  }, [countries, cssSize, visited]);

  return (
    <canvas ref={canvasRef} className="world-map-canvas">
      訪問した国・地域をハイライトした世界地図
    </canvas>
  );
}
