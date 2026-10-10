# 本番環境

本番は未設定です。Cloudflareリソース・本番DB・資格情報・ドメイン・CDは作成していません。ローカル用の `wrangler.local.jsonc` と、無効な本番参考例 `config/wrangler.worker.example.jsonc` を区別してください。実際の設定・公開は別途のデプロイ作業です。

## 日次消去

scheduled handlerは `0 18 * * *`（UTC18:00、JST翌03:00）に対応します。SESSIONと全所有者の親子データ・手動稼働・割当・要求履歴を同じD1トランザクションで削除し、70件のREGION_MASTERを保持します。失敗時は全体がロールバックされます。リセット後の古いCookieは新しいセッションへ更新し、次のアクセスで架空の10事務所・3案件を再投入します。入力内容は保存用途には使えません。

ローカルcron式はscheduledイベントの検証用です。この設定変更では実環境のCronを登録しません。本番参考例のtriggersとDB bindingはコメントのままです。公開HTTPのresetルートはありません。ローカル検証は `npm test -- tests/backend/reset.test.ts` で行えます。

GitHubの管理設定は変更していません。ローカルpre-merge-commitフックは通常のローカルマージを止めますが、GitHubのマージやfast-forwardを制御しません。
