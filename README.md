# 設備協力者プール — ローカルデモ

架空の設備協力事務所を管理し、案件に合う候補を抽出・割当できます。日本語の4画面を実際のWorker/D1 APIへ接続しています。本番は未公開で、Cloudflareへのデプロイ・リソース作成・実環境Cron登録・CD追加は行っていません。外部API・AI・GA4などの計測は使用しません。

[requirements.md](requirements.md)が仕様の原文です。21,184 bytes、SHA-256 `89ad526d468315e1e009037fe57b2d572ba2d03d9beb46a7961d7ab48d568fd6`を保持しています。共通ルールの適用は[WORK/1](WORK/1/rule-selection.md)、API契約は[docs/api.md](docs/api.md)を参照してください。

## ローカル起動

Node.js 24 / npmを使用します。Cloudflareのログイン・秘密情報は不要です。依存パッケージを入れ直す前に、このリポジトリの開発サーバーを停止してください。

```sh
# home/cacheが書込不可のクラウド環境でも使用できるローカルパスです。
export npm_config_cache=/tmp/mep-npm-cache
export XDG_CONFIG_HOME=/tmp/mep-wrangler-config
export WRANGLER_LOG_PATH=/tmp/mep-wrangler-logs
export WRANGLER_SEND_METRICS=false
npm ci
npm run hooks:install
npx wrangler d1 migrations apply mep-partner-pool-demo-local --local --config wrangler.local.jsonc
npm run dev:api
```

別のターミナルで同じ環境変数を設定し、`npm run dev`を実行します。APIは8787、画面は5173です。`http://127.0.0.1:5173`を使用してください。Viteが`/api`をWorkerへ転送し、固定したAPP_ORIGINとmutationのOriginを照合します。localhostなど別のoriginに読み替えると書込は拒否されます。停止はCtrl-Cです。

| 画面 | ローカルURL |
| --- | --- |
| 事務所一覧 | http://127.0.0.1:5173/#partners |
| 事務所登録・編集・稼働 | http://127.0.0.1:5173/#partners/new 、一覧から `#partners/:id` |
| 案件一覧・登録・編集 | http://127.0.0.1:5173/#projects 、一覧から `#projects/new` / `#projects/:id/edit` |
| 案件詳細・候補・確定・取消 | 一覧から `#projects/:id` |

初回アクセスで架空の10事務所・3案件を投入します。Cookieでブラウザごとの所有者を分離し、他のブラウザのIDでは操作できません。個人名・連絡先・住所などの個人情報を入力しないでください。資格判定は仕様の簡略ルールで、法令適合の保証には使えません。

## 操作

事務所一覧は分野・資格・地域で絞り込めます。登録・編集では全項目と用途×業務種別の6実績を設定し、期間ごとの手動稼働を追加・取消できます。案件を登録して詳細から候補を抽出すると、条件と派生条件、単独/組の順位、分野別担当、実績・余裕・資格の根拠、折りたたみの全除外理由を確認できます。0件の場合の緩和案は提案だけで、条件を自動変更しません。

画面内確認で全分野または片分野を確定できます。一部割当後は再抽出して残分野を確定します。取消は当該割当由来の稼働を戻し、手動稼働は残します。確定がある事務所・案件は取消後に編集・削除してください。別タブで条件や稼働が変わった候補は確定時に再検証し、古い候補は再抽出へ誘導します。通信失敗は画面内で通知して再取得できます。

日次リセットのscheduled handlerはUTC18:00（JST翌03:00）です。全所有者のデータを原子的に消去し、地域マスタ70件を保持します。次のアクセスで新しいCookieと架空サンプルを作るため、保存用途には使えません。ローカルcron式はscheduledイベントの検証用で、本番Cronは未登録です。公開HTTPのresetルートはありません。[本番環境の境界](ENV/PRODUCTION.md)を参照してください。

## API一覧

以下はすべて`/api`配下です。ID・関連IDは検証済みCookie所有者で絞り込みます。mutationにはJSON、同一origin、honeypot、更新revisionなどの検証があります。入力と応答の詳細は[API契約](docs/api.md)を参照してください。

| パス | メソッド |
| --- | --- |
| `/health`、`/regions` | GET |
| `/partners`、`/projects` | GET / POST |
| `/partners/:id`、`/projects/:id` | GET / PUT / DELETE |
| `/partners/:id/engagements` | GET / POST |
| `/partners/:id/engagements/:engagementId` | DELETE |
| `/projects/:id/candidates` | POST |
| `/projects/:id/assignments` | POST |
| `/projects/:id/assignments/:assignmentId` | DELETE |

`/health`は`{status:"demo-ready",featuresImplemented:true}`を返し、セッションを作りません。本番公開済みを意味するものではありません。

## 検証

```sh
npm run check                 # lint・4境界の型検査・Vitest・frontend build・Worker dry-run
npm run security:check
npm run typecheck:e2e
npm run test:e2e              # ローカルD1 migration適用後に実ブラウザを起動
# 起動済みの開発サーバーに対して:
npm run smoke
```

Playwrightはデスクトップ1280×900とスマホ390×844で実APIを検証します。この環境は`/usr/bin/chromium`を使用できます。他の環境では`npx playwright install chromium`、CIでは公式Chromiumと必要なOS依存を導入します。サーバー未起動の場合はPlaywrightが起動・終了し、既存サーバーを使った場合はそのプロセスを終了しません。実D1のVitest、npm ci、ブラウザテストを同時実行しないでください。[開発環境](ENV/DEVELOPMENT.md)と[Issue #9の検証記録](WORK/9/verification.md)に証跡を記載します。自動検証はユーザー本人のブラウザ受入確認とは別です。

frontendは`dist/frontend`、Workerは`dist/backend`へ出力します。backend buildはWranglerの`--dry-run`だけを使います。CIはread-only権限で検証し、デプロイjobやsecretはありません。`wrangler.local.jsonc`は`remote:false`のローカルD1、config内の本番参考例は無効なままです。実際の公開は別のデプロイ作業として扱います。
