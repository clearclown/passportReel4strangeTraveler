# 台帳の項目と状態

更新日: 2026年11月1日。JSONのキーは処理用に英語、説明と判断理由は日本語で記入する。全JSONの`schemaVersion`は1。

## 地域を識別する項目

`regions.json`の`entries`が地域台帳の原本である。`defaults`は、各地域で省略された項目の値を示す。実効統治、国際承認、各分野の権限、国番号、ドメインの未確認と、アプリの訪問先への採用は別々に記録する。代表地点は別の原本を参照し、集計方針は訪問先ID単位で定めている。

| 項目 | 意味と記入ルール |
| --- | --- |
| `id` | 台帳内で変えない識別子。`iso3166-1:JP`、`region:gagauzia`など。名称や所属だけで変更しない |
| `nameJa` / `nameOriginal` / `aliases` | 日本語名、原名、検索用の別名。別名を別の地域として追加しない |
| `applicationCode` | 現在のアプリの保存・検索に使われるコード。既存の2文字コードまたは採用地域の`region:<slug>`。未採用は`null` |
| `iso3166_1` | 取り込んだ参照版で照合した割当コード。XKには設定しない |
| `subdivisionCodes` | 固定版の行政区画行との対応。現在の公式コードの確認完了を意味しない |
| `contextCodes` | 調査を始める国・地域コードの一覧。領有権・法的所属・実効支配を表す項目ではない |
| `origin` | `existing-app`または`research-candidate` |
| `tags` | 複数付けられる分類。`candidate`を含むタグは、現在の地位の確定を意味しない |
| `classificationStatus` | `documented`は資料に分類の根拠となる記述がある状態。`unreviewed`は未確認。採否は別項目 |
| `decision` | 採否、判断の根拠、理由。既存候補の保持は互換性を理由とする |
| `statements` | 資料で確認した記述、主張、確認が必要な事項を出典付きで記録する |
| `relationships` | 確認した関係。`kind`、`targetId`、`sourceRefs`を持つ。初版の`legally-part-of`は資料が明示する法的所属 |
| `temporal` | 時間的な扱い。`status`、`validFrom`、`validUntil`を持つ。未確認の開始・終了日は`null` |
| `map` | 形状と既存アプリの対応状況。現在の統治範囲・国際承認の確認とは分ける |
| `sourceRefs` | 出典台帳のIDの一覧 |
| `openQuestions` | 次に確認する事項。根拠が不十分な点を空欄で隠さない |

採否の`decision.status`は次の4値にする。

| 値 | 意味 |
| --- | --- |
| `accepted` | 採用理由を付けて保持する。既存コードは互換性、追加地域は任意の訪問先として採用する。国家性・自治の強さの認定とは別 |
| `excluded` | 対象から除外する。行と除外理由は残す |
| `pending` | 資料の不足や方針の未確定により保留する |
| `unreviewed` | 採否をまだ検討していない |

## 制度上の権限と実際の運用を確認する

`autonomyPowers`は制度上の権限、`effectiveAutonomyPowers`は実際に行使される権限を表す。どちらも`legislation`、`executiveSelection`、`taxation`、`judiciary`、`policing`、`entryControl`の6項目を持つ。

各項目は`documented`、`absent`、`unreviewed`、`not-applicable`で記録する。`documented`や`absent`へ変更するときは、対応する`statements`に根拠と対象時点を加える。「議会がある」という記述だけから、独立した立法権を推定しない。

`effectiveGovernance`と`internationalRecognition`も、初版の値は`unreviewed`である。確認後は、誰が・どの範囲を・どの時点で統治しているか、誰が・何を・どの時点で承認したかを`statements`に記録する。「国家としての承認」と、外交窓口や経済関係の存在を区別する。

`telephoneCountryCodes`、`ccTlds`の`null`は未入力を表す。代表地点は`representativePoint.locationId`で`map-locations.json`を参照し、未設定は`null`にする。`map-locations.json`には緯度・経度・出典の項目ID・版・固定版URLを記録する。地点は境界や実効支配を表さない。

`countingPolicy: unique-destination`は、訪問先ID単位で数え、親国を自動追加せず、同じ訪問先の複数年の記録を重複集計しない方針を表す。`undecided`は算入方法が未確定の状態で、歴史上の統治体に設定している。

## 出典の記述を扱う

`statements`の各要素は次の項目を持つ。

| 項目 | 意味 |
| --- | --- |
| `topic` | 法的地位、制度の説明、形状、当事者の主張などの主題 |
| `text` | 根拠の範囲に限定した短い日本語の記述 |
| `status` | `documented`は記述を確認、`needs-current-verification`は現在の状態との照合が必要 |
| `sourceRefs` | 記述を支える出典ID |
| `reviewedOn` | 記述を確認した日。資料の対象日と混同しない |
| `basisDate` | その記述が説明する日・年。年だけ分かる場合は年で記入し、不明なら`null` |
| `locator` | 条番号・段落番号など。分かる場合に記入する |

`sourceRefs`に地域政府や領有を主張する当事者の資料がある場合は、その立場を示す。声明、法律、裁判の起訴状、判決、研究上の分類を同じ種類の根拠として扱わない。資料で言及されていないことから「存在しない」と判断しない。

`sources.json`には資料の役割、版、記述を確認した日、制約を記録する。`reviewedOn: null`は参考資料として所在を登録した状態で、今回の確認済み資料ではない。

## 行政区画の探索候補を扱う

`subdivision-candidates.json`には参照版の全行を残す。

| 項目 | 意味 |
| --- | --- |
| `code` | 参照版に収録される行政区画コード |
| `nameOriginal` | 参照版の原名。古い名称があっても原文を残す |
| `parentCode` | 参照版の上位コード。国コードとは限らず、別の行政区画を指すことがある |
| `contextCode` | コードの国・地域部分。調査の起点として使う |
| `linkedRegionId` | 重点台帳に対応づけた地域。対応の有無と採否は別。未照合は`null` |
| `classificationStatus` / `decisionStatus` | 行の現在の分類・採否の確認状況。初版では全行`unreviewed` |
| `sourceRefs` / `reviewNote` | 参照元と、旧名称などの確認事項 |

法律上の行政区画と同名の実効統治体があっても、同じ対象とは限らない。沿ドニエストルとMD-SN、アブハジアとGE-ABなどは、自動で同一の識別子へ統合していない。

## 国と地域ごとの調査を進める

`country-reviews.json`の起点は、既存候補の250コードである。`overallStatus`は初版では`unreviewed`または`partial`であり、`complete`はない。重点対象の確認が始まった国・地域を`partial`にしている。

`checks`は既存候補の取り込み、行政区画の取り込み、法的地位、実効統治、係争地域、共同体・ミクロネーション、歴史上の統治体、形状の8項目である。

`imported`と`snapshot-imported`は取り込み済み、`partial`は一部確認、`unreviewed`は未確認、`not-in-source-snapshot`は参照版に行がないことを示す。`not-in-source-snapshot`を候補の不存在へ読み替えない。

候補を採用しても、国全体の調査が完了したことにはならない。`complete`へ進める際は、各確認項目の対象資料・版・日時を記録し、候補の未照合・未確認・保留を解消する。資料不足で確認できない範囲は、その理由を`issues`に残す。

## 出典が列挙する集合と収録候補を照合する

`coverage-groups.json`は、範囲を限定した一覧との収録照合を記録する。`coverage-groups.md`は同じ内容の閲覧用一覧である。各集合は一つの資料・条文などで範囲を明記し、国全体の確認状況と分けて扱う。

| 項目 | 意味 |
| --- | --- |
| `id` / `title` / `contextCode` | 集合の識別子、名称、探索の起点 |
| `scope` | 照合した資料の範囲。含める行政段階や条文を明示する |
| `expectedCount` | その出典の範囲で列挙される地域数 |
| `regionIds` | 一つずつ対応づけた地域台帳のID。集合内の重複は認めない |
| `listingStatus` | `reconciled`は、出典の列挙と地域IDを照合できた状態 |
| `rightsReviewStatus` | 現在は全件`incomplete`。制度上の権限・実際の運用の調査は未完了 |
| `sourceRefs` / `sourceLocator` | 出典IDと、条文・見出しなどの照合箇所 |
| `reviewedOn` / `basisDate` | 照合した日と、資料が説明する時点。不明な対象日は`null` |
| `limitations` | この集合に含めない範囲、版や現在の運用に関する未確認事項 |

件数の一致だけで`reconciled`にはしない。出典が挙げる各地域を識別子と対応づけ、取り違えや漏れがないことを確認する。異なる集合は重なり得るため、集合の件数をそのまま訪問先の総数として足さない。`reconciled`から国全体の`overallStatus: complete`や候補の採用を自動で決めない。

## 用語

| 用語 | この台帳での意味 |
| --- | --- |
| 既存候補 | 現在のアプリの日本語検索一覧にある国・地域 |
| 追加候補 | 新たな訪問先として調査する地域。採用確定とは限らない |
| 探索の起点 | 関連する資料を調べるための国・地域。所属の認定ではない |
| 参照スナップショット | ある版から取り込んだデータ。現在の事実の保証とは分ける |
| 記述を確認 | 資料にその内容が書かれていることを確認した状態 |
| 実効統治 | 実際に行政などを行っている主体とその範囲 |
| 保留 | 根拠や方針が未確定で、採否をまだ決められない状態 |
