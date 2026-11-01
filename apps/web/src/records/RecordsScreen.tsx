import { useCallback, useMemo, useState } from "react";
import { Sheet } from "../Sheet";
import { WorldMapCanvas } from "../WorldMapCanvas";
import { RecordForm } from "./RecordForm";
import { RecordList } from "./RecordList";
import type { VisitRecordsState } from "./useVisitRecords";
import { visitedCountries } from "./visitRecords";

type Props = {
  readonly visitRecords: VisitRecordsState;
  /** PC 幅では左のパネルに入力欄と一覧、スマートフォン幅では上に地図・下に一覧を置き、入力欄はシートに置く。 */
  readonly wide: boolean;
  readonly initialCode?: string;
};

/** 訪問記録を追加・確認・削除する画面。 */
export function RecordsScreen({ visitRecords, wide, initialCode }: Props) {
  const { records, persistent, add, remove } = visitRecords;
  const [sheetOpen, setSheetOpen] = useState(initialCode !== undefined);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  // 地図は visited が変わるたびに描き直すため、入力中の再描画で作り直さないよう記録が変わったときだけ求める
  const visited = useMemo(() => visitedCountries(records), [records]);

  const notice = !persistent && (
    <output className="notice">
      この端末では記録を保存できません。ページを閉じると記録は消えます。
    </output>
  );

  const map = (
    <div className="map-stage">
      <WorldMapCanvas visited={visited} />
      <p className="visited-count">
        <span className="visited-count-number">{visited.size}</span>
        か国・地域
      </p>
    </div>
  );

  if (wide) {
    return (
      <div className="records-wide">
        <aside className="records-panel" aria-label="訪問記録">
          <RecordForm records={records} onAdd={add} layout="inline" initialCode={initialCode} />
          {notice}
          <div className="records-scroll">
            <RecordList
              records={records}
              onRemove={remove}
              emptyHint="上の入力欄で年と国・地域を選んで追加してください。"
            />
          </div>
        </aside>
        {map}
      </div>
    );
  }

  return (
    <div className="records-narrow">
      {map}
      <section className="records-scroll" aria-label="訪問記録">
        {notice}
        <RecordList
          records={records}
          onRemove={remove}
          emptyHint="「＋ 記録を追加」から訪れた国・地域を登録してください。"
        />
      </section>
      <div className="bottom-bar">
        <button
          type="button"
          className="button button--primary button--block"
          onClick={() => setSheetOpen(true)}
        >
          ＋ 記録を追加
        </button>
      </div>
      {sheetOpen && (
        <Sheet title="記録を追加" onClose={closeSheet} tall>
          <RecordForm records={records} onAdd={add} layout="stacked" initialCode={initialCode} />
        </Sheet>
      )}
    </div>
  );
}
