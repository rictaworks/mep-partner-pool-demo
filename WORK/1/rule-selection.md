# mep-partner-pool-demo の setup ルール選定

参照元: [rictaworks/context/setup/Claude](https://github.com/rictaworks/context/tree/8f1ed19bd075c89a3f445141ba8123591d895b92/setup/Claude)

参照コミット: `8f1ed19bd075c89a3f445141ba8123591d895b92`。確認日: 2026-10-10 JST。実ファイルを取得して確認しました。プロジェクトは **人間向けウェブ / デモ版 / TypeScript / Cloudflare Pages + Workers + 将来の D1** です。MVP・製品版ではありません。requirements.md は変更しません。

## 適用・部分適用

| 参照ファイル（setup/Claude/ 相対） | このプロジェクトの選定 |
|---|---|
| `CLAUDE.md` | 削除コマンドを作成しない、秘密情報を保存・stage しない、ignore と commit 前の status を確認します。 |
| `CLAUDE_A.md` | 参照先の docs/ 5ファイルを実際に読み、下記の範囲で採用します。 |
| `ClaudeCode.md` | src/ 分離、main 以外の issue ブランチ、PR、CI、事前 security review、日本語の PR・ブラウザのみの利用者向け確認手順、モデル名フッターを採用します。デモ向け Cloudflare 例外を採用します。UI は日本語のですます調、標準的な最小表示です。 |
| `Manager.md` | DEMO の機能実装は1 issue、環境構築・実装・デバッグは分離します。setup issue に Depends on と Edit scope を明記します。機能 issue の細分化や自動アサインは行いません。 |
| `docs/agent-workflow.md` | issue 起点、最小変更、検証、通常レビュー後の security review、事実に基づく報告を採用します。merge/close は今回禁止です。 |
| `docs/pr-rules.md` | 目的・変更・影響・検証・レビュー・security review・未対応を PR に記録します。基本の branch 名 `claude/issue-1` に合わせます。Draft と明示的 merge 保留はマージ禁止という規定も適用します。 |
| `docs/review-policy.md` | 正しさ・保守性・テスト品質・変更範囲を確認します。独立したモデルによる review 実施とは区別します。 |
| `docs/security-review.md` | 入力・認可境界・機密情報・外部 I/O・CI をレビューします。未実装の session 分離を合格扱いにしません。 |
| `docs/test-commands.md` | npm ci / lint / test / build を実行し、TypeScript の typecheck も追加します。 |
| `chat/project-instructions.md` | 製品ライン定義、Domain Core 分離、src/ 構成、ウェブの Cloudflare 例外、個人情報抑制、デモの Cookie 所有者分離・SQLite/D1・JST03:00 リセット・外部API禁止を選定します。既存仕様の再生成は行いません。 |
| `OWASP10.md` | setup の露出面に適用します。SQL・cookie・CSRF 等は未実装のため、機能実装時の検証項目として残します。監視基盤はデモ仕様外です。 |
| `QC10.md` | HTML の言語・見出し、viewport、可読性、応答エラー、依存関係の確認を行います。公開 SEO/OGP・構造化データ・PageSpeed・本番 HTTPS は未公開 setup では対象外です。WCAG や法令への適合を主張しません。 |
| `CC.md` | 著作物・個人情報・誤解を招く表示に注意します。素材・商用課金・医療表現はありません。商標調査、法務監修、Cookie 同意要否の法的判定を実施済みとはしません。 |
| `TEST-HARNESS-SAFETY.md` | 標準 Vitest を使用し、自作ランナーや自己再帰する subprocess テストは作りません。CI はコマンドとジョブの timeout を設定します。 |
| `WF.md` | ドメインと adapter の責務分離、将来の SQLite 制約を参考にします。GraphQL、APIキー、OAuth、監査基盤はこの demo の要件にないため追加しません。 |

参照を解決した関連ファイル: `setup/DOCS/DP.md`（KISS/YAGNI・責務分離・秘密管理）、`setup/DOCS/TM.md`（単体・結合・受入の区別）、`setup/DOCS/CRAP.md`（最小画面の読みやすさ）。`QC.md` は存在せず、現行の `QC10.md` を使用します。これらは読み取り確認のみで、context リポジトリは変更しません。

## 非適用

- `DC.md`: Codespaces/devcontainer の作成依頼ではなく、既存の選択済み環境を使うため作成しません。Docker や追加 DB サービスも導入しません。
- `AI_POLICY.md`: 制作モデルの役割メモです。この環境は Codex であり、Claude/Gemini を実行したとは記載しません。実行時の AI 依存は要件で禁止されています。
- `ClaudeCode_OLD.md`: 旧版として現行の `ClaudeCode.md` を優先します。旧 AWS/Cognito/多言語方針は適用しません。
- `auto-optimizer.md`: 既存 CLAUDE.md の最適化依頼ではありません。
- `chat/idea-instructions.md`, `chat/manual-instructions.md`, `chat/strategy-instructions.md`: アイデア・マニュアル・戦略の新規制作ではありません。
- `chat/05_nano_banana.md`: 画像がない setup であり、生成画像は必要ありません。
- `chat/project-instructions.md` の MVP/製品版、AI向け配布・ホスト、書籍・動画・IoT の章: 対象エディション／プラットフォームが異なります。該当しない章の詳細適用は行いません。
- Rails/Next/PostgreSQL、Google/Xログイン、Railway/Vercel、reCAPTCHA、Jev、計測・監視: Cloudflare demo と現行 requirements の指定を優先します。計算・日付比較は同ファイルの Jev 非適用条件にも一致します。

## 衝突の解決・残る差分

1. 「全 issue を実装・merge」「公開」「権限スキップ」は今回の明示指示に従い実行しません。Issue は open、PR は draft のまま残します。CD、正式 release、監査 PDF、認証設定も作成しません。
2. `chat/project-instructions.md` の demo 節は security review スキップを記載していますが、`ClaudeCode.md` と docs/security-review.md は実施を要求します。限定された setup の通常・security review を実施する側を選びます。
3. 「README に未実装のものを書くな」と今回の「未完成を明記」は、今回の指示を優先し、利用可能な機能と誤認させない表示にします。機能仕様を README に完成品として列挙しません。
4. 初期 scaffold はテスト前に記述しました。TDD の red-first 遵守を遡って主張しません。後続機能は red → 実装 → green を適用してください。
5. commit 前の補助 security hook を用意します。手動 review の代替ではありません。ローカル merge 抑止フックは GitHub 側を制御できず、reviewer/pr-checker の強制実行や branch protection は未設定です。今回は merge 禁止で停止します。
6. Claude/Sonnet/Opus 指定の独立レビュー、Claude Desktop sandbox>chrome の利用者テストは未実施です。レビュー結果とローカル HTTP 検証を区別して報告します。アプリにログインを追加しません。
7. 固定された短い UI 文言は HTML、HTTP の protocol 定数は adapter 内に置いています。「全文字列を外出し」「ハードコードテスト」は未適用です。設定ファイルに同じ定数を移すだけの抽象化を避ける最小 setup 判断であり、全規則に完全準拠したとは主張しません。
8. `TASKS/DEBUG/CLIENT/SPEC/DELETE` の空ディレクトリは作らず、issue、元の requirements、WORK、ENV で現時点の成果物を管理します。元仕様を SPEC に移動・複製しません。

この記録は本プロジェクトで今回確認した範囲を示します。他の setup でも過去に同じ確認をしていたという証明ではありません。

## 共通デモ UI の追加確認

ユーザーの「yt-director-workbench 以外のアプリは共通 UI」という追加指示を受け、既存の [electricity-plan-advisor-demo/frontend/src/app/layout.tsx](https://github.com/rictaworks/electricity-plan-advisor-demo/blob/6dc69eed5dfd3719bf287ebe2c3d61ecdb98bfa5/frontend/src/app/layout.tsx) を読み取りました。commit は `6dc69eed5dfd3719bf287ebe2c3d61ecdb98bfa5` です。デモ表示、`https://rictaworks.jp/#demos` への戻るリンク、`https://rictaworks.jp/` への相談リンク、および GA4 script を確認しました。共通パッケージとは確認できず、既存アプリの実装例として扱います。

この setup には静的なデモ一覧・相談リンクを採用しました。元アプリの「再起動でデータリセット」文言は、まだ保存機能のない本 setup に不適切なためコピーせず、「開発準備中」と表示します。外部アイコン CDN は追加しません。法的ページへの URL はこの実装例では確認できないため捏造しません。

**未解決: GA4。** 共通アプリ方針と requirements §1.3 / §15 の測定なしが衝突します。ユーザー判断が必要であり、GA4 script・measurement ID・依存をコピーせず、tracking は無効のままです。requirements.md は byte-for-byte 不変です。別途進行中の横断監査結果でこの適用範囲を補足できます。既存デモのコードは変更していません。
