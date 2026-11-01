import { useEffect, useState } from "react";
import { Sheet } from "../Sheet";
import { CatalogDataLicenses } from "./CatalogDataLicenses";
import { type LicenseEntry, LICENSES_URL, parseLicenses, sourceUrl } from "./thirdPartyLicenses";

type Props = {
  readonly onClose: () => void;
};

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "loaded"; readonly entries: readonly LicenseEntry[] };

/**
 * 同梱したオープンソースのライセンス一覧のシート。
 * 一覧はビルド時に生成されるファイルで、アプリの JS に含めると起動が重くなるため、開いたときに読み込む。
 */
export function LicenseSheet({ onClose }: Props) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(LICENSES_URL, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((json: unknown) => {
        const entries = parseLicenses(json);
        setState(entries ? { status: "loaded", entries } : { status: "error" });
      })
      .catch(() => {
        // シートを閉じて中断したときは、閉じた後のシートの状態を変えない
        if (!controller.signal.aborted) {
          setState({ status: "error" });
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <Sheet title="ライセンス" onClose={onClose} tall centeredOnWide>
      <div className="license-content">
        <p className="license-lead">
          このアプリは次のオープンソースソフトウェアを利用しています。地図データは Natural
          Earth（パブリックドメイン）をもとにしています。
        </p>
        <CatalogDataLicenses />
        <h3>ソフトウェア</h3>
        {state.status === "loading" && <p className="license-status">読み込んでいます…</p>}
        {state.status === "error" && (
          <p className="license-status">
            ライセンス一覧を読み込めませんでした。
            {import.meta.env.DEV &&
              "一覧はビルド時に生成するため、開発サーバーでは表示できません。"}
          </p>
        )}
        {state.status === "loaded" && (
          <ul className="license-list">
            {state.entries.map((entry) => (
              <li key={`${entry.name}@${entry.version}`}>
                <details className="license-item">
                  <summary>
                    <span className="license-name">{entry.name}</span>
                    <span className="license-meta">
                      {entry.version}
                      {entry.identifier && ` · ${entry.identifier}`}
                    </span>
                  </summary>
                  <a
                    className="license-source"
                    href={sourceUrl(entry)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ソースコード（npm）
                  </a>
                  {entry.text && <pre className="license-text">{entry.text}</pre>}
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
