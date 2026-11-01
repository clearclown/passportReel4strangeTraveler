import { useCallback, useId, useMemo, useReducer, useRef, useState } from "react";
import {
  browseReducer,
  catalog,
  CATEGORIES,
  contextName,
  contexts,
  INITIAL_BROWSE_STATE,
  paginate,
  searchRegions,
  searchSubdivisions,
  statusLabel,
  TAG_LABELS,
  type Filters,
} from "./catalog";
import { CatalogDetails, type Selection } from "./CatalogDetails";
import { ResearchProgress } from "./ResearchProgress";

/** 台帳の閲覧専用画面。候補を開いても訪問記録や採否を変更しない。 */
export default function CatalogScreen({
  onRecord,
}: {
  readonly onRecord?: (code: string) => void;
}) {
  const [{ filters, mode, page: requestedPage }, dispatch] = useReducer(
    browseReducer,
    INITIAL_BROWSE_STATE,
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const closeDetail = useCallback(() => setSelection(null), []);
  const prefix = useId();
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const regions = useMemo(
    () => (mode === "regions" ? searchRegions(filters) : []),
    [filters, mode],
  );
  const subdivisions = useMemo(
    () => (mode === "subdivisions" ? searchSubdivisions(filters) : []),
    [filters, mode],
  );
  const total = mode === "regions" ? regions.length : subdivisions.length;
  const regionPage = paginate(regions, requestedPage);
  const subdivisionPage = paginate(subdivisions, requestedPage);
  const page = mode === "regions" ? regionPage : subdivisionPage;
  const change = (values: Partial<Filters>) => dispatch({ type: "filters", filters: values });
  function goToPage(next: number) {
    dispatch({ type: "page", page: next });
    resultsHeading.current?.focus();
    resultsHeading.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="catalog-screen">
      <div className="catalog-content">
        <header className="catalog-header">
          <p className="catalog-eyebrow">REGION CATALOG</p>
          <h2>地域を探す</h2>
          <p>国・自治地域・共同体を、名前や分類から探す。</p>
          <div className="catalog-stats">
            <span>
              地域台帳 <strong>{catalog.regions.length}</strong> 件
            </span>
            <span>
              記録できる訪問先{" "}
              <strong>
                {
                  catalog.regions.filter(
                    (entry) =>
                      entry.applicationCode !== null && entry.decision.status === "accepted",
                  ).length
                }
              </strong>{" "}
              件
            </span>
            <span>
              行政区画の参照 <strong>{catalog.subdivisions.length.toLocaleString("ja-JP")}</strong>{" "}
              件
            </span>
          </div>
          <p className="catalog-meta">
            更新日 {catalog.snapshotDate} ·
            調査・閲覧用です。掲載は国家承認や訪問先への採用を意味しません。
          </p>
        </header>

        <fieldset className="catalog-mode">
          <legend className="catalog-sr-only">検索する一覧</legend>
          <button
            type="button"
            aria-pressed={mode === "regions"}
            onClick={() => dispatch({ type: "mode", mode: "regions" })}
          >
            地域台帳
          </button>
          <button
            type="button"
            aria-pressed={mode === "subdivisions"}
            onClick={() => dispatch({ type: "mode", mode: "subdivisions" })}
          >
            行政区画の参照一覧
          </button>
        </fieldset>
        <search className="catalog-filters" aria-label="地域の検索と絞り込み">
          <div className="field catalog-query">
            <label htmlFor={`${prefix}-query`}>名前・別名・コードで検索</label>
            <input
              id={`${prefix}-query`}
              className="control"
              type="search"
              value={filters.query}
              placeholder={mode === "regions" ? "ガガウズ、Gagauzia、MD-GA…" : "Yogyakarta、ID-YO…"}
              onChange={(event) => change({ query: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-context`}>関連する国・地域</label>
            <select
              className="control"
              id={`${prefix}-context`}
              value={filters.context}
              onChange={(event) => change({ context: event.target.value })}
            >
              <option value="">すべての国・地域</option>
              {contexts.map((entry) => (
                <option key={entry.contextCode} value={entry.contextCode}>
                  {entry.nameJa}（{entry.contextCode}）
                </option>
              ))}
            </select>
          </div>
          {mode === "regions" && (
            <>
              <div className="field">
                <label htmlFor={`${prefix}-category`}>分類</label>
                <select
                  className="control"
                  id={`${prefix}-category`}
                  value={filters.category}
                  onChange={(event) => change({ category: event.target.value })}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${prefix}-review`}>資料の確認状況</label>
                <select
                  className="control"
                  id={`${prefix}-review`}
                  value={filters.review}
                  onChange={(event) => change({ review: event.target.value })}
                >
                  <option value="all">すべての確認状況</option>
                  <option value="documented">資料に記述あり</option>
                  <option value="unreviewed">未確認</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${prefix}-origin`}>掲載区分</label>
                <select
                  className="control"
                  id={`${prefix}-origin`}
                  value={filters.origin}
                  onChange={(event) => change({ origin: event.target.value })}
                >
                  <option value="all">すべての掲載区分</option>
                  <option value="existing-app">既存の選択肢</option>
                  <option value="research-candidate">台帳の追加地域</option>
                </select>
              </div>
            </>
          )}
        </search>
        {mode === "subdivisions" && (
          <p className="catalog-reference-note">
            固定版の名称・コードを調べる一覧です。現在の制度・境界・自治権限の確認は未完了です。
          </p>
        )}

        <div className="catalog-results-header">
          <h3 ref={resultsHeading} tabIndex={-1}>
            検索結果 <output aria-live="polite">{total.toLocaleString("ja-JP")}件</output>
          </h3>
          <button
            type="button"
            className="catalog-text-button"
            onClick={() => dispatch({ type: "reset" })}
          >
            条件を解除
          </button>
        </div>
        {total === 0 ? (
          <p className="catalog-empty">
            条件に一致する地域がありません。検索語を変えるか、条件を解除してください。
          </p>
        ) : (
          <>
            <p className="catalog-meta">
              {page.from.toLocaleString("ja-JP")}–{page.to.toLocaleString("ja-JP")}件を表示
            </p>
            <ul className="catalog-results">
              {mode === "regions"
                ? regionPage.entries.map((entry) => (
                    <li key={entry.id}>
                      <div className="catalog-result-main">
                        <h4>{entry.nameJa}</h4>
                        <p className="catalog-meta">
                          {entry.nameOriginal} · {entry.contextCodes.map(contextName).join("、")}
                        </p>
                        <div className="catalog-tags">
                          {entry.tags
                            .filter((tag) => tag !== "baseline")
                            .map((tag) => (
                              <span key={tag}>{TAG_LABELS[tag] ?? "分類の確認が必要"}</span>
                            ))}
                        </div>
                      </div>
                      <div className="catalog-result-action">
                        <span className="catalog-meta">
                          {entry.origin === "existing-app"
                            ? "既存の選択肢"
                            : statusLabel(entry.decision.status)}
                        </span>
                        <span className="catalog-meta">
                          {statusLabel(entry.classificationStatus)}
                        </span>
                        <button
                          className="button button--secondary"
                          type="button"
                          aria-label={`${entry.nameJa}の詳細`}
                          onClick={() => setSelection({ kind: "region", entry })}
                        >
                          詳細を見る
                        </button>
                      </div>
                    </li>
                  ))
                : subdivisionPage.entries.map((entry) => (
                    <li key={entry.code}>
                      <div className="catalog-result-main">
                        <h4>{entry.nameOriginal}</h4>
                        <p className="catalog-meta">
                          {entry.code} · 上位 {entry.parentCode} · {contextName(entry.contextCode)}
                        </p>
                        {entry.reviewNote && <p className="catalog-meta">{entry.reviewNote}</p>}
                      </div>
                      <div className="catalog-result-action">
                        <span className="catalog-meta">制度・実態は未確認</span>
                        <button
                          className="button button--secondary"
                          type="button"
                          aria-label={`${entry.nameOriginal}（${entry.code}）の詳細`}
                          onClick={() => setSelection({ kind: "subdivision", entry })}
                        >
                          詳細を見る
                        </button>
                      </div>
                    </li>
                  ))}
            </ul>
            <nav className="catalog-pagination" aria-label="検索結果のページ">
              <button
                type="button"
                className="button button--secondary"
                disabled={page.page === 0}
                onClick={() => goToPage(page.page - 1)}
              >
                前へ
              </button>
              <span>
                {page.page + 1} / {page.pages}
              </span>
              <button
                type="button"
                className="button button--secondary"
                disabled={page.page + 1 === page.pages}
                onClick={() => goToPage(page.page + 1)}
              >
                次へ
              </button>
            </nav>
          </>
        )}
        <ResearchProgress context={filters.context} onSelect={setSelection} />
      </div>
      {selection && (
        <CatalogDetails
          selection={selection}
          onClose={closeDetail}
          onSelect={setSelection}
          onRecord={onRecord}
        />
      )}
    </div>
  );
}
