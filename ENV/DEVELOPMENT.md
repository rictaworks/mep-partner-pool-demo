# 開発環境

Node.js 24 / npm、Vite、TypeScript、Vitest、ESLint、Wrangler を使用します。
手順とポートは [README](../README.md#ローカル起動) を参照してください。
初回に `npm run hooks:install` を実行すると、このリポジトリだけにコミット前の補助チェックを設定します。
コミット前に手動の通常レビュー・セキュリティレビューも実施し、結果を PR に記録してください。
フックは秘密情報らしいファイル名・一部のキー形式・差分の空白を検査する補助です。完全な検出やコードレビューの代替ではありません。

## Local D1

`wrangler.local.jsonc` binds DB only to local SQLite/D1 with an inert UUID and `remote:false`. Run `npx wrangler d1 migrations apply mep-partner-pool-demo-local --local --config wrangler.local.jsonc` before local API development. Never remove `--local` or use the inactive production template during this task. No resource creation or deployment is needed.

`tests/backend/harness.ts` creates real workerd/Miniflare D1 databases, applies all migrations and disposes instances. It uses the installed Wrangler transitive Miniflare package and its exported V4 compatibility conversion (the pinned package is v5). Tests disable metadata fetch and telemetry. D1 tests allow 30 seconds for local Worker startup; they do not replace ownership tests with mocks.

Session cookies last 24 hours and are server-issued opaque IDs. Local HTTP omits Secure; HTTPS includes Secure. Mutation callers send same-origin Origin and JSON, then strict body/honeypot checks apply in HTTP adapters. A DB error propagates; there is no in-memory fallback.

Persistence snapshots read SESSION revision first, then owner-scoped entities. Every subsequent mutation uses Repository.guardedBatch(owner, revision, statements): revision update + a CHECK-constrained transient owner guard + writes + guard cleanup in one D1 batch. If any other write commits between snapshot and write, the guard aborts the whole batch. All future writes must use this guard; batch alone without revision guard does not protect read/write races. Reset must delete assignment-related rows before partners because confirmed assignments restrict partner deletion, and then delete SESSION; REGION_MASTER survives. Guard rows carry session_id and a SESSION foreign key.

実D1互換テストはMiniflare/workerdを使います。このクラウド環境で複数インスタンスを同時実行すると接続が切断されたため、Vitestのファイル並列実行を無効にしています。並列要求の整合性テストは各suite内で実行します。

## ブラウザで確認する

ローカルD1へ全migrationを適用してから `npm run test:e2e` を実行します。サーバーが未起動ならPlaywrightがWorker8787/Vite5173を起動して終了時に停止します。既存サーバーを再利用した場合は、そのプロセスを停止しません。クラウド環境では `/usr/bin/chromium` を使い、CIは `npx playwright install --with-deps chromium` で公式Chromiumを入れます。`npm run typecheck:e2e` でブラウザテスト自体も型検査します。Vitestの実D1テスト、npm ci、別のWorkerを同時実行しないでください。

デスクトップ1280×900とモバイル390×844で実APIを検証します。`WORK/9/browser-results/` は一時的な失敗調査用でgit管理外です。保存する画像は架空データの正常画面のみです。起動済みのローカルサーバーに対する `npm run smoke` も実APIを使い、新しいセッションの架空案件を作成して削除します。ブラウザごとにCookieで分離されるため、Cookieを削除すると別のサンプルデータになります。
