import { Component, lazy, Suspense, type ReactNode } from "react";

// 大きな参照一覧は、地域を探す画面を初めて開いたときに読み込む。
const CatalogScreen = lazy(() => import("./CatalogScreen"));

class CatalogBoundary extends Component<
  { readonly children: ReactNode },
  { readonly failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="catalog-load-state" role="alert">
          <p>地域台帳を読み込めませんでした。接続を確認して再読み込みしてください。</p>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => window.location.reload()}
          >
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function CatalogView({ onRecord }: { readonly onRecord: (code: string) => void }) {
  return (
    <CatalogBoundary>
      <Suspense
        fallback={<output className="catalog-load-state">地域台帳を読み込んでいます…</output>}
      >
        <CatalogScreen onRecord={onRecord} />
      </Suspense>
    </CatalogBoundary>
  );
}
