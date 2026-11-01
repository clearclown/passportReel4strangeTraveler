import { countryBadge, countryName } from "./countryNames";
import { groupByYear, isRevisit, type VisitRecord } from "./visitRecords";

type Props = {
  readonly records: readonly VisitRecord[];
  readonly onRemove: (record: VisitRecord) => void;
  /** 記録がないときに示す、追加の方法。画面の構成によって追加の入口が異なるため呼び出し側が渡す。 */
  readonly emptyHint: string;
};

/** 年ごとにまとめた訪問記録の一覧。新しい年が上。 */
export function RecordList({ records, onRemove, emptyHint }: Props) {
  if (records.length === 0) {
    return (
      <div className="record-list-empty">
        <p>まだ記録がありません。</p>
        <p>{emptyHint}</p>
      </div>
    );
  }
  return (
    <div className="record-list">
      {groupByYear(records).map((group) => (
        <section key={group.year} aria-labelledby={`year-${group.year}`}>
          <h2 id={`year-${group.year}`} className="record-year">
            {group.year}
          </h2>
          <ul>
            {group.records.map((record) => {
              const name = countryName(record.country);
              return (
                <li key={record.country} className="record-row">
                  <span className="country-code">{countryBadge(record.country)}</span>
                  <span className="record-name">{name}</span>
                  {isRevisit(records, record) && <span className="tag">再訪</span>}
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${record.year}年 ${name} を削除`}
                    onClick={() => onRemove(record)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
