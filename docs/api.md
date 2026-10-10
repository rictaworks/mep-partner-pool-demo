# API 契約

本書は Issue #3 の共有契約です。各ルートの実装は #4〜#7 で行います。URL は同一 origin の `/api` 配下です。request / response のプロパティは camelCase、列挙値は requirements.md の日本語値を使います。型の正本は `src/core/types.ts` と `src/backend/contracts.ts` です。

## 所有者と HTTP 境界

所有者はサーバーが生成した opaque ID の Cookie `mep_session` を検証して決めます。body/query の sessionId/owner は拒否し、所有者外 ID と存在しない ID は共に 404 とします。全データ操作・関連参照・join は検証済み owner を必須にします。地域マスタだけは共有です。

Cookie は HttpOnly、SameSite=Lax、Path=/、有効期限24時間、本番 HTTPS では Secure とします。任意 Cookie を新規 owner に採用せず、不明/無効/失効 Cookie は新しいサーバー生成セッションに交換します。GET による CRUD・候補状態・割当状態の変更は行いません。セッション初期化と原子的サンプル投入は初回アクセスのインフラ処理として行います。

mutation は同一 origin の Origin を検証し、cross-site Fetch Metadata も拒否します。JSON body は Content-Type: application/json、最大32,768 bytesです。無制限 CORS は許可しません。全 mutation に `website: ""` ハニーポット欄を含めます。空でない場合は保存せず204を返します。欠落/非文字列は検証エラーです。

## ルート

| Method / URL | Request | Response |
|---|---|---|
| GET /regions | なし | RegionsResponse |
| GET /partners | なし | PartnersResponse |
| POST /partners | PartnerRequest | 201 PartnerResponse |
| GET /partners/:id | なし | PartnerResponse |
| PUT /partners/:id | PartnerUpdateRequest | PartnerResponse |
| DELETE /partners/:id | Honeypot | 204 |
| GET /partners/:id/engagements | なし | EngagementsResponse |
| POST /partners/:id/engagements | EngagementRequest | 201 EngagementResponse |
| DELETE /partners/:id/engagements/:engagementId | Honeypot | 204 |
| GET /projects | なし | ProjectsResponse |
| POST /projects | ProjectRequest | 201 ProjectResponse |
| GET /projects/:id | なし | ProjectResponse |
| PUT /projects/:id | ProjectUpdateRequest | ProjectResponse |
| DELETE /projects/:id | Honeypot | 204 |
| POST /projects/:id/candidates | CandidateRequest | CandidatesResponse |
| POST /projects/:id/assignments | AssignmentRequest | AssignmentsResponse |
| DELETE /projects/:id/assignments/:assignmentId | CancellationRequest | AssignmentsResponse |

ID は正の安全整数です。成功JSONは `{data: ...}`、失敗JSONは `{error:{code,message,details?}}` です。204 は body を持ちません。400 VALIDATION/BAD_JSON、403 CSRF、404 NOT_FOUND、405 METHOD_NOT_ALLOWED、409 CONFLICT/STALE_CANDIDATE、413 BODY_TOO_LARGE、415 UNSUPPORTED_MEDIA_TYPE、500 INTERNALを使います。details は入力パスと安全な説明だけです。Cookie/SQL/stack/内部例外の値を返しません。障害を成功や in-memory fallback として扱いません。

## 入力

PartnerRequest はコード・略称・分野・資格・用途×種別の6実績・地域・業務・上限・受付状態です。コードは英数字/`_`/`-` の1〜32文字、略称は1〜80文字、案件名は1〜120文字、制御文字は拒否します。略称欄には個人名を避ける注記を表示します。unknown property、unknown enum、重複集合値、欠落必須値を拒否します。分野のみ非空必須です。地域・業務・資格は空も保存できますが、必要な地域/業務を満たさない事務所は抽出から除外されます。

ProjectRequest は `requiredFields,workType,use,region,floors,floorArea,period:{start,end},requiredServices,orderType,requireListedLicense,name` です。階数は正の安全整数、面積は正の有限数、上限と全実績は0以上の安全整数です。日付は実在する西暦0001〜9999の `YYYY-MM-DD`、両端含む開始≤終了です。案件地域には68区市のみ、事務所地域には全域2指定を含む70値を許可します。地域コードは5桁JISコード、全域は `13-all` / `14-all` です。展開・地域充足は core の共通関数を使います。

## 候補と割当

CandidatesResponse は純粋 MatchingResult と取得時の projectRevision を返します。Candidate は rank、single/pair、partnerCodes（単独1コード、組2つの異なるコード）、electrical/mechanical（担当不要時null）、basis、notesです。クライアントが送る順位/資格/実績/余裕は信用しません。除外理由・派生条件・最小緩和・poolInsufficientを返し、法令適合を保証する表現は使いません。

AssignmentRequest は `requestId,projectRevision,selections:[{partnerId,fields}],website` です。requestId は1〜64文字の英数字/`_`/`-`、owner/案件内で同じ要求の再送を冪等にします。同じキーで異なる内容は409です。単独事務所の両分野は1 selectionで指定します。片分野の先行割当も可能ですが、残分野と既存確定を含めた資格・候補成立を再判定し、不成立を完了としません。状態は registered→candidates→partial/assigned、取消→candidatesです。

確定時は最新データを再判定し、revision不一致や不適格は409で再抽出を促します。再判定から稼働追加までを競合に強い原子的処理とし、read→batchのみを原子性保証としません。単独には稼働1件、組には各社1件。同じ事務所が既存の当該案件の残分野を担当する場合、自己案件由来の稼働を二重に数えず追加稼働も作りません。他案件・手動稼働は常に数えます。

取消は当該 owner/案件/割当由来の稼働だけを戻し、繰り返しも安全です。手動稼働ルートは assignmentId が付いた稼働を操作できません。確定がある案件の条件変更/削除と確定中事務所の削除は409で取消を先に要求します。更新は revision を検証し、成功時に増加させます。関連データ更新による候補の陳腐化は確定時の最新全件再判定で拒否します。

日次リセットは UTC18:00 の scheduled handler のみで行い、公開HTTPルートはありません。REGION_MASTER以外を削除し、次のアクセスで新セッションとサンプルを作ります。

## CRUD 実装時の安全な制限

所有者ごとに事務所100件・案件100件・稼働1,000件まで登録できます。seed を含めて数え、上限は409 CONFLICTとします。競合時もsession revision guardで上限のread/writeを保護します。選定計算量の増大を抑えるデモの制限です。

確定中の事務所は削除に加えて編集も409で拒否します。資格や対応条件の編集で既存確定を無効にしないため、取消を先に求めます。案件の条件変更後はregisteredに戻し、revisionを増加させます。手動稼働DELETEは対象事務所・所有者・manual由来が一致する行だけ操作します。存在しない対象と他ownerの対象は共に404です。CRUD一覧の絞り込みはUIで行い、APIはqueryを受け取りません。

`/health` はCRUD実装段階では `{status:"crud-ready",featuresImplemented:false}` を返します。全業務機能完成とは表示しません。

用途ごとの新築+改修実績の合計も安全整数内とし、巨大な数値の丸めで順位の同点判定を誤らないようサーバー検証します。

ローカルVite→WorkerプロキシはWorker URLをAPIポートへ正規化するため、`APP_ORIGIN=http://127.0.0.1:5173` をローカル設定に固定し、mutationのOriginをその値へ厳密照合します。任意Host/転送ヘッダーやリクエストbodyから許可Originを決めません。本番同一originでは未設定時にrequest URL originを使い、別の信頼済みプロキシが正規化する場合のみ、別途承認された本番構成で正しいアプリOriginを明示してください。
