# passport-reel
訪れたことのある国を時系列で可視化して動画にする

# 開発環境

- 開発環境は DevContainer を使うことを前提としている。
- Node.js / Claude Code / Codex / OpenSpec は mise（`mise.toml`）、pnpm は `package.json#packageManager` で版数を固定する。
- 依存パッケージは公開から7日以上経ったものだけを入れる（`minimumReleaseAge`）。npm/npx は使わず pnpm を使う。

## 構成

| パス | 内容 |
| --- | --- |
| `apps/web` | Web アプリ本体（Vite + React + TypeScript、フロントエンドのみ）。`pnpm --filter ./apps/web build` で `apps/web/dist` に静的ファイルを出力し、Cloudflare Workers で配信する |
| `openspec/` | 仕様と変更提案（OpenSpec） |
| `docs/design-guidelines.md` | 見た目の方針（配色、書体、レイアウト、地図の配色、将来の画面の指針） |
| `docs/spikes/` | スパイク（技術検証）の結果と、それに基づく判断 |
| [`docs/region-catalog/`](docs/region-catalog/README.md) | 訪問国・自治地域・共同体などの調査台帳。地域の分類・出典・採否と、国・地域別の確認状況を管理する |
| `.agents/skills/` | コーディングエージェント用 skills（`.claude/skills` から symlink） |

## 地域を探す

アプリの「地域を探す」から、地域台帳と行政区画の参照一覧を検索できる。日本語名・原名・別名・コードで探し、関連する国・地域、分類、資料の確認状況で絞り込む。各地域の詳細には、根拠となる記述、出典と対象時点、未確認事項を表示する。国別の調査状況と、出典が列挙する集合との収録照合も確認できる。

既存250件と追加65件、計315件を訪問先として記録できる。「沿ドニエストル共和国」「ガガウズ」「カラカルパクスタン」などで検索するか、台帳の詳細から「訪問記録に追加」を選び、年を指定して追加する。保存データはv1の国コードを維持して読み、追加・削除後にv2で保存する。

訪問数は同じ地域の再訪を重複させず、訪問先ID単位で「か国・地域」と数える。親国は自動追加しない。形状のない地域は代表地点のマーカーで示し、地域の境界や実効支配の認定とは分ける。歴史上の統治体1件と行政区画の参照5,070件は閲覧用に残す。

原本は`docs/region-catalog/`のJSONで、更新時は対応するMarkdown一覧も更新する。`pnpm generate:destinations`で小さな訪問先データと追加境界を再生成する。本番ビルドと開発サーバーの起動時にも生成し、`pnpm check`は生成漏れを検出する。表示のための外部APIは使わない。

## コマンド

```
pnpm install
pnpm check   # lint + format:check + typecheck + knip + test
pnpm fix     # lint:fix + format
```

## デプロイ

`apps/web` のビルド結果を Cloudflare Workers の静的アセットとして配信する。設定は `apps/web/wrangler.jsonc` にある。

デプロイは Workers Builds（Cloudflare の Git 連携）で行う。`main` への push は本番に、それ以外のブランチはプレビュー URL にデプロイされる。ダッシュボードの Build 設定は次のとおり。

| 項目 | 値 |
| --- | --- |
| Root directory | `apps/web` |
| Build command | `pnpm build` |
| Deploy command | `pnpm run deploy` |
| Non-production branch deploy command | `pnpm run deploy:preview` |

同梱した依存パッケージのライセンス一覧は、ビルド時に Vite が `dist/third-party-licenses.json` として書き出し（`apps/web/vite.config.ts` の `build.license`）、画面の上部バーの「ライセンス」から開くシートに表示する。開発サーバーでは生成されないため、表示を確かめるときは `pnpm build` してから `pnpm preview` で開く。

地域台帳に手動で取り込んだ参照データのMIT許諾文は、原本から別途同梱し、同じシートの「地域台帳の参照データ」に表示する。この部分は開発サーバーでも表示できる。

公開リポジトリのため、秘密情報は `wrangler.jsonc` に書かず、`wrangler secret` かダッシュボードの Secrets で設定する。
