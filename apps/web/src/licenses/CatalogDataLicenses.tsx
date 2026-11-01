import isoLicense from "../../../../docs/region-catalog/licenses/iso-3166-MIT.txt?raw";
import namesLicense from "../../../../docs/region-catalog/licenses/i18n-iso-countries-MIT.txt?raw";
import sourceData from "../../../../docs/region-catalog/sources.json";

const LICENSE_TEXTS: Readonly<Record<string, string>> = {
  "iso-reference": isoLicense,
  "app-country-names": namesLicense,
};

/** 手動で取り込んだデータはViteの依存ライブラリ一覧に出ないため、原本の許諾文を別に同梱する。 */
export function CatalogDataLicenses() {
  return (
    <section className="catalog-data-licenses">
      <h3>地域台帳の参照データ</h3>
      <p className="license-lead">
        地域名・行政区画の参照一覧に次の固定版を利用しています。各地域の資料は「地域を探す」の詳細から確認できます。
      </p>
      <ul className="license-list">
        {sourceData.entries
          .filter(
            (entry) =>
              LICENSE_TEXTS[entry.id] ||
              entry.id === "wikidata-coordinates" ||
              entry.id === "srpska-geometry",
          )
          .map((entry) => (
            <li key={entry.id}>
              <details className="license-item">
                <summary>
                  <span className="license-name">{entry.title}</span>
                  <span className="license-meta">
                    {LICENSE_TEXTS[entry.id] ? `${entry.version} · MIT` : entry.license}
                  </span>
                </summary>
                <p className="catalog-meta">{entry.publisher}</p>
                {!LICENSE_TEXTS[entry.id] && (
                  <p className="catalog-meta">
                    版: {entry.version}。{entry.note}
                  </p>
                )}
                {entry.url && (
                  <a
                    className="license-source"
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    固定版の取得元 ↗
                  </a>
                )}
                {LICENSE_TEXTS[entry.id] ? (
                  <pre className="license-text">{LICENSE_TEXTS[entry.id]}</pre>
                ) : (
                  entry.licenseUrl && (
                    <a
                      className="license-source"
                      href={entry.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      利用条件 ↗
                    </a>
                  )
                )}
              </details>
            </li>
          ))}
      </ul>
    </section>
  );
}
