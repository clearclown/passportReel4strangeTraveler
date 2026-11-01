import { type KeyboardEvent, type SubmitEvent, useId, useRef, useState } from "react";
import { isImeConfirmingEnter, soleSelectableCandidate } from "./candidates";
import { type CountryName, countryBadge, findCountry, searchCountries } from "./countryNames";
import { hasRecord, MIN_YEAR, type VisitRecord } from "./visitRecords";

type Props = {
  readonly records: readonly VisitRecord[];
  readonly onAdd: (record: VisitRecord) => void;
  /** PC のパネルでは横並び、スマートフォンのシートでは縦並びにする。 */
  readonly layout: "inline" | "stacked";
  readonly initialCode?: string;
};

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - MIN_YEAR + 1 }, (_, i) => currentYear - i);

/**
 * 年と国・地域を選んで訪問記録を追加する入力欄。台帳からの移動時はinitialCodeを選択済みにする。
 * 国の候補はネイティブのボタンで並べ、国の欄で↓を押すと候補へ移り、↑↓で候補間を移動して Enter で選ぶ。
 * 選べる候補が 1 か国だけのときは、その国を強調し、選ばずに国の欄の Enter（フォームの送信）や追加ボタンで追加できる。
 * 追加後は続けて同じ年の国を登録できるよう、国の欄だけを空にして年は残す。
 */
export function RecordForm({ records, onAdd, layout, initialCode }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [year, setYear] = useState(currentYear);
  const initialCountry = initialCode ? findCountry(initialCode) : undefined;
  const [query, setQuery] = useState(initialCountry?.name ?? "");
  const [selected, setSelected] = useState<CountryName | undefined>(initialCountry);

  const candidates = selected ? [] : searchCountries(query);
  const showList = !selected && query.trim() !== "";
  const isAdded = (code: string) => hasRecord(records, { year, country: code });
  const selectedIsAdded = selected !== undefined && isAdded(selected.code);
  const sole = soleSelectableCandidate(candidates, isAdded);
  const countryToAdd = selected ?? sole;

  function choose(country: CountryName) {
    setSelected(country);
    setQuery(country.name);
    inputRef.current?.focus();
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!countryToAdd || isAdded(countryToAdd.code)) {
      return;
    }
    onAdd({ year, country: countryToAdd.code });
    setSelected(undefined);
    setQuery("");
    inputRef.current?.focus();
  }

  /** 選べる候補ボタンの間でフォーカスを移す。端を越えると国の欄に戻る。 */
  function moveFocus(event: KeyboardEvent, from: HTMLElement | null) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const buttons = [...(listRef.current?.querySelectorAll("button:enabled") ?? [])];
    const index = from ? buttons.indexOf(from) : -1;
    const next =
      event.key === "ArrowDown" ? index + 1 : (index === -1 ? buttons.length : index) - 1;
    const target = buttons[next];
    if (target instanceof HTMLElement) {
      target.focus();
    } else {
      inputRef.current?.focus();
    }
  }

  return (
    <form className={`record-form record-form--${layout}`} onSubmit={handleSubmit}>
      <div className="field field--year">
        <label htmlFor={`${id}-year`}>年</label>
        <select
          id={`${id}-year`}
          className="control"
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="field field--country">
        <label htmlFor={`${id}-country`}>国・地域</label>
        <div className="country-row">
          <input
            ref={inputRef}
            id={`${id}-country`}
            className="control"
            type="text"
            autoComplete="off"
            placeholder="国・地域名で検索"
            aria-describedby={showList ? `${id}-candidates-label` : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(undefined);
            }}
            onKeyDown={(event) => {
              // 変換確定の Enter でフォームが送信され、意図せず記録が追加されるのを防ぐ
              if (isImeConfirmingEnter(event.nativeEvent)) {
                event.preventDefault();
                return;
              }
              if (showList) {
                moveFocus(event, null);
              }
            }}
          />
          <button
            className="button button--primary"
            type="submit"
            disabled={!countryToAdd || selectedIsAdded}
          >
            追加
          </button>
        </div>
        {showList && (
          <div className="candidates">
            <p id={`${id}-candidates-label`} className="candidates-label">
              {candidates.length === 0
                ? "一致する国・地域がありません"
                : `候補 ${candidates.length} 件`}
            </p>
            <ul ref={listRef}>
              {candidates.map((country) => {
                const added = isAdded(country.code);
                return (
                  <li key={country.code}>
                    <button
                      type="button"
                      className={country === sole ? "candidate candidate--sole" : "candidate"}
                      disabled={added}
                      onClick={() => choose(country)}
                      onKeyDown={(event) => moveFocus(event, event.currentTarget)}
                    >
                      <span className="country-code">{countryBadge(country.code)}</span>
                      <Highlighted text={country.name} query={query} />
                      {added && <span className="tag">追加済み</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {selectedIsAdded && (
        <p className="form-note">
          {year} 年の {selected.name} は追加済みです
        </p>
      )}
    </form>
  );
}

/** 国名のうち入力と同じ文字列の部分を強調する。ひらがな入力などで表記が異なる場合は強調しない。 */
function Highlighted({ text, query }: { readonly text: string; readonly query: string }) {
  const trimmed = query.trim();
  const index = trimmed === "" ? -1 : text.indexOf(trimmed);
  if (index < 0) {
    return <span className="candidate-name">{text}</span>;
  }
  return (
    <span className="candidate-name">
      {text.slice(0, index)}
      <mark>{text.slice(index, index + trimmed.length)}</mark>
      {text.slice(index + trimmed.length)}
    </span>
  );
}
