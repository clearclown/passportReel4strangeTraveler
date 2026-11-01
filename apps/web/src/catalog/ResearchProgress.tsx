import { useState } from "react";
import { catalog, contextName, regionsById, reviewCounts, statusLabel } from "./catalog";
import { SourceLinks, type Selection } from "./CatalogDetails";

const CHECK_LABELS: Readonly<Record<string, string>> = {
  baselineImport: "既存候補の取り込み",
  subdivisionImport: "行政区画の取り込み",
  legalStatus: "法的地位",
  effectiveGovernance: "実効統治",
  disputedTerritories: "係争地域",
  communitiesAndMicronations: "共同体・ミクロネーション",
  historicalEntities: "歴史上の統治体",
  geometry: "地図形状",
};

function CountryReview({ review }: { readonly review: (typeof catalog.reviews)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="catalog-review" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        {review.nameJa}
        <span>{statusLabel(review.overallStatus)}</span>
      </summary>
      {open && (
        <>
          <p className="catalog-meta">
            参照行 {review.importedSubdivisionCount}件 · 追加候補 {review.candidateRegionIds.length}
            件 · 確認日 {review.lastReviewedOn ?? "未確認"}
          </p>
          <dl className="catalog-facts">
            {Object.entries(review.checks).map(([key, check]) => (
              <div className="catalog-fact-row" key={key}>
                <dt>{CHECK_LABELS[key]}</dt>
                <dd>
                  {statusLabel(check.status)}
                  {"sourceRefs" in check && check.sourceRefs && (
                    <SourceLinks refs={check.sourceRefs} />
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {review.issues.length > 0 && (
            <ul>
              {review.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </details>
  );
}

export function ResearchProgress({
  context,
  onSelect,
}: {
  readonly context: string;
  readonly onSelect: (selection: Selection) => void;
}) {
  const counts = reviewCounts();
  // 初期表示では250地域分の詳細をDOMに並べず、開いた一覧と確認表だけを描画する。
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const reviews = catalog.reviews.filter((review) => !context || review.contextCode === context);
  const groups = catalog.coverage.filter((group) => !context || group.contextCode === context);
  return (
    <section className="catalog-research" aria-label="調査状況">
      <h2>調査の進み具合</h2>
      <p className="catalog-meta">
        全{catalog.reviews.length}国・地域：一部確認 {counts.partial} · 未確認 {counts.unreviewed} ·
        調査完了 {counts.complete}
      </p>
      <details
        className="catalog-disclosure"
        onToggle={(event) => setReviewsOpen(event.currentTarget.open)}
      >
        <summary>国・地域別の確認状況{context && `：${contextName(context)}`}</summary>
        <p>
          行政区画の件数は参照版から取り込んだ行数です。制度の調査完了や、高度自治の地域数ではありません。0件でも候補がないとは限りません。
        </p>
        {reviewsOpen && (
          <div className="catalog-review-list">
            {reviews.map((review) => (
              <CountryReview review={review} key={review.contextCode} />
            ))}
          </div>
        )}
      </details>
      <details
        className="catalog-disclosure"
        onToggle={(event) => setCoverageOpen(event.currentTarget.open)}
      >
        <summary>出典の一覧との収録照合（{groups.length}集合）</summary>
        <p>
          指定した資料の列挙と照合した範囲です。権限や実際の自治、国全体の調査が完了したことを意味しません。
        </p>
        {groups.length === 0 && (
          <p className="catalog-meta">
            この関連先について、照合済みの集合はまだ登録されていません。
          </p>
        )}
        {coverageOpen &&
          groups.map((group) => (
            <article className="catalog-coverage" key={group.id}>
              <h3>{group.title}</h3>
              <p>{group.scope}</p>
              <p className="catalog-meta">
                収録 {group.regionIds.length} / 出典の列挙 {group.expectedCount} ·{" "}
                {statusLabel(group.listingStatus)} · 権限・運用の確認：
                {statusLabel(group.rightsReviewStatus)}
              </p>
              <p className="catalog-meta">
                照合箇所: {group.sourceLocator} / 確認日: {group.reviewedOn} / 対象時点:{" "}
                {group.basisDate ?? "未確認"}
              </p>
              <SourceLinks refs={group.sourceRefs} />
              <div className="catalog-region-links">
                {group.regionIds.map((id) => {
                  const entry = regionsById.get(id);
                  return (
                    entry && (
                      <button
                        type="button"
                        className="catalog-text-button"
                        key={id}
                        onClick={() => onSelect({ kind: "region", entry })}
                      >
                        {entry.nameJa}
                      </button>
                    )
                  );
                })}
              </div>
              <ul>
                {group.limitations.map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
              </ul>
            </article>
          ))}
      </details>
    </section>
  );
}
