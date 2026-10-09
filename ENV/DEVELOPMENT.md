# 開発環境

Node.js 24 / npm、Vite、TypeScript、Vitest、ESLint、Wrangler を使用します。
手順とポートは [README](../README.md#local-development) を参照してください。
初回に `npm run hooks:install` を実行すると、このリポジトリだけにコミット前の補助チェックを設定します。
コミット前に手動の通常レビュー・セキュリティレビューも実施し、結果を PR に記録してください。
フックは秘密情報らしいファイル名・一部のキー形式・差分の空白を検査する補助です。完全な検出やコードレビューの代替ではありません。
