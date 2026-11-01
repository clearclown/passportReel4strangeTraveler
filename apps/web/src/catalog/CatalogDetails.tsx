import { Sheet } from "../Sheet";
import { findCountry } from "../records/countryNames";
import destinations from "../regions/destinations.json";
import mapFallbacks from "../regions/mapFallbacks.json";
import {
  attributeText,
  contextName,
  regionAttributes,
  regionsById,
  sourcesById,
  statusLabel,
  TAG_LABELS,
  type Region,
  type Subdivision,
} from "./catalog";

export type Selection =
  | { readonly kind: "region"; readonly entry: Region }
  | { readonly kind: "subdivision"; readonly entry: Subdivision };

const SOURCE_ROLES: Readonly<Record<string, string>> = {
  "standard-publisher": "規格の発行元",
  "reference-dataset": "参照データ",
  "research-codebook": "研究の分類基準",
  "discovery-reference": "候補の探索資料",
  "geometry-dataset": "地図形状データ",
  "geometry-reference": "地図位置・形状の参照資料",
  "repository-implementation": "既存アプリの実装",
  "claimant-statement": "主張する当事者の声明",
  "territorial-government-explanation": "地域政府の説明",
  "territorial-government-statement": "地域政府の声明",
  "territorial-government-legal-list": "地域政府の法令一覧",
  "regional-legal-text": "地域の法令",
  "national-government-explanation": "中央政府の説明",
  "national-government-statement": "中央政府の声明",
  "central-government-institutional-list": "中央政府の制度一覧",
  "central-government-institutional-explanation": "中央政府の制度説明",
  "central-government-historical-explanation": "中央政府による制度の沿革",
  "central-government-historical-statement": "中央政府の過去の声明",
  "national-legal-text": "国の法令",
  "official-legal-text": "公式の法令本文",
  "parliament-published-constitutional-text": "議会公開の憲法本文",
  "national-legislature-institutional-explanation": "国会の制度説明",
  "tribunal-indictment": "国際法廷の起訴状",
  "government-republished-statistical-news": "政府サイト掲載の統計記事",
  "official-tourism-explanation": "公式観光機関の説明",
  "indigenous-government-explanation": "先住民政府の説明",
  "institutional-statement": "機関の声明",
  "intergovernmental-explanation": "政府間機関の説明",
  "international-organization-project-description": "国際機関の事業説明",
  "electoral-authority-historical-report": "選挙機関の過去の報告",
};

export function SourceLinks({ refs }: { readonly refs: readonly string[] }) {
  return (
    <ul className="catalog-source-links">
      {[...new Set(refs)].map((ref) => {
        const source = sourcesById.get(ref);
        if (!source) return null;
        return (
          <li key={ref}>
            {source.url ? (
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title} ↗
              </a>
            ) : (
              source.title
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Sources({ refs }: { readonly refs: readonly string[] }) {
  return (
    <section>
      <h3>出典と資料の制約</h3>
      {[...new Set(refs)].map((ref) => {
        const source = sourcesById.get(ref);
        if (!source) return null;
        return (
          <article className="catalog-source" key={ref}>
            <h4>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title} ↗
                </a>
              ) : (
                source.title
              )}
            </h4>
            <p className="catalog-meta">
              {source.publisher} · {SOURCE_ROLES[source.role] ?? "参考資料"}
            </p>
            <p className="catalog-meta">
              版: {source.version ?? "未確認"} / 記述の確認日: {source.reviewedOn ?? "未確認"}
            </p>
            <p>{source.note}</p>
          </article>
        );
      })}
    </section>
  );
}

const POWER_LABELS = [
  ["legislation", "立法"],
  ["executiveSelection", "政府の選出"],
  ["taxation", "税財政"],
  ["judiciary", "司法"],
  ["policing", "警察"],
  ["entryControl", "入出域管理"],
] as const;
const locationSources = new Map(
  [...destinations, ...mapFallbacks].map((entry) => [entry.code, entry.point]),
);

/** 未入力と不存在、資料で確認した制度と実効自治を別に表示する。 */
export function RegionDetails({ region }: { readonly region: Region }) {
  const attributes = regionAttributes(region);
  const referenceCode = region.origin === "existing-app" ? region.applicationCode : null;
  const point = region.applicationCode ? locationSources.get(region.applicationCode) : undefined;
  return (
    <>
      <p className="catalog-original">{region.nameOriginal}</p>
      <div className="catalog-tags">
        {region.tags.map((tag) => (
          <span key={tag}>{TAG_LABELS[tag] ?? "分類の確認が必要"}</span>
        ))}
      </div>
      <dl className="catalog-facts">
        <dt>掲載区分</dt>
        <dd>{statusLabel(region.decision.status)}</dd>
        <dt>資料の確認</dt>
        <dd>{statusLabel(region.classificationStatus)}</dd>
        <dt>関連する国・地域</dt>
        <dd>
          {region.contextCodes.map(contextName).join("、")}
          <small>資料を調べる起点。所属や領有権の認定ではありません。</small>
        </dd>
        {region.aliases.length > 0 && (
          <>
            <dt>別名</dt>
            <dd>{region.aliases.join("、")}</dd>
          </>
        )}
        {(referenceCode || region.subdivisionCodes.length > 0) && (
          <>
            <dt>参照コード</dt>
            <dd>{[referenceCode, ...region.subdivisionCodes].filter(Boolean).join("、")}</dd>
          </>
        )}
      </dl>
      <section>
        <h3>資料に記載された内容</h3>
        {region.statements.length === 0 && (
          <p className="catalog-meta">制度や実態を確認した記述はまだありません。</p>
        )}
        {region.statements.map((statement, index) => (
          <article className="catalog-statement" key={`${statement.topic}-${index}`}>
            <p className="catalog-meta">{statusLabel(statement.status)}</p>
            <p>{statement.text}</p>
            <p className="catalog-meta">
              対象時点: {statement.basisDate ?? "未確認"} / 記述の確認日: {statement.reviewedOn}
              {statement.locator && ` / ${statement.locator}`}
            </p>
            <SourceLinks refs={statement.sourceRefs} />
          </article>
        ))}
      </section>
      <section>
        <h3>未確認事項</h3>
        {region.openQuestions.length ? (
          <ul>
            {region.openQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        ) : (
          <p>個別の調査事項は未記入です。制度や実効自治の調査完了を意味しません。</p>
        )}
      </section>
      <section>
        <h3>掲載・採否の理由</h3>
        <p>{region.decision.reason}</p>
      </section>
      {point && region.map.status === "representative-point-in-app" && (
        <section>
          <h3>地図の代表地点</h3>
          <p>
            緯度 {point.latitude.toFixed(4)} / 経度 {point.longitude.toFixed(4)}
          </p>
          <p className="catalog-meta">
            地域の概略位置を示す地点です。地域全体の境界や統治範囲ではありません。
          </p>
          <a href={point.sourceUrl} target="_blank" rel="noopener noreferrer">
            座標の出典（固定版）↗
          </a>
        </section>
      )}
      {region.relationships.length > 0 && (
        <section>
          <h3>資料上の構成関係</h3>
          <ul>
            {region.relationships.map((relation) => (
              <li key={`${relation.kind}-${relation.targetId}`}>
                {regionsById.get(relation.targetId)?.nameJa ?? "関係先の確認が必要"}
                <SourceLinks refs={relation.sourceRefs} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <details className="catalog-disclosure">
        <summary>電話・ドメイン・自治権限を確認</summary>
        <dl className="catalog-facts">
          <dt>電話国番号</dt>
          <dd>{attributeText(attributes.telephoneCountryCodes)}</dd>
          <dt>国別ドメイン</dt>
          <dd>{attributeText(attributes.ccTlds)}</dd>
        </dl>
        <div className="catalog-table-scroll">
          <table className="catalog-table">
            <caption>制度上と実際の自治権限</caption>
            <thead>
              <tr>
                <th>分野</th>
                <th>制度上</th>
                <th>実際の運用</th>
              </tr>
            </thead>
            <tbody>
              {POWER_LABELS.map(([key, label]) => (
                <tr key={key}>
                  <th>{label}</th>
                  <td>{statusLabel(attributes.autonomyPowers[key])}</td>
                  <td>{statusLabel(attributes.effectiveAutonomyPowers[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <Sources
        refs={[
          ...region.sourceRefs,
          ...region.statements.flatMap((statement) => statement.sourceRefs),
          ...region.relationships.flatMap((relation) => relation.sourceRefs),
        ]}
      />
    </>
  );
}

export function CatalogDetails({
  selection,
  onClose,
  onSelect,
  onRecord,
}: {
  readonly selection: Selection;
  readonly onClose: () => void;
  readonly onSelect: (selection: Selection) => void;
  readonly onRecord?: (code: string) => void;
}) {
  const title = selection.kind === "region" ? selection.entry.nameJa : selection.entry.nameOriginal;
  const subdivision = selection.kind === "subdivision" ? selection.entry : null;
  const linked = subdivision?.linkedRegionId
    ? regionsById.get(subdivision.linkedRegionId)
    : undefined;
  const recordCode = selection.kind === "region" ? selection.entry.applicationCode : undefined;
  const recordable = recordCode ? findCountry(recordCode) : undefined;
  return (
    <Sheet title={title} onClose={onClose} tall centeredOnWide>
      <div className="catalog-detail">
        {recordable && onRecord && (
          <button
            type="button"
            className="button button--primary button--block"
            onClick={() => onRecord(recordable.code)}
          >
            訪問記録に追加
          </button>
        )}
        {selection.kind === "region" &&
          selection.entry.origin === "research-candidate" &&
          recordable && (
            <p className="catalog-meta">
              地域の記録は親国と別に数えます。地図の地点表示は代表位置を示し、領域の境界を表すものではありません。
            </p>
          )}
        {selection.kind === "region" && <RegionDetails region={selection.entry} />}
        {subdivision && (
          <>
            <p>行政区画の参照行です。現在の地位・境界・自治権限は未確認です。</p>
            <dl className="catalog-facts">
              <dt>コード</dt>
              <dd>{subdivision.code}</dd>
              <dt>上位コード</dt>
              <dd>{subdivision.parentCode}</dd>
              <dt>関連する国</dt>
              <dd>{contextName(subdivision.contextCode)}</dd>
              <dt>確認状況</dt>
              <dd>{statusLabel(subdivision.classificationStatus)}</dd>
            </dl>
            {subdivision.reviewNote && (
              <section>
                <h3>確認が必要な点</h3>
                <p>{subdivision.reviewNote}</p>
              </section>
            )}
            {linked && (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => onSelect({ kind: "region", entry: linked })}
              >
                {linked.nameJa}の地域台帳を見る
              </button>
            )}
            <Sources refs={subdivision.sourceRefs} />
          </>
        )}
      </div>
    </Sheet>
  );
}
