WhyWhy Board (whywhybord)

シンプルに「なぜなぜ分析（5 Whys）」を行える Web アプリです。ノードを追加して因果関係（なぜ→原因→対策）を整理し、TOML で保存・読み込み、PNG 画像としてエクスポートできます。

主な機能
- ノード編集: 文章入力、採用(チェック)のトグル
- ノード追加: 右クリックメニュー、または右ハンドルを空白にドラッグ
- 自動整列: 兄弟ノードを等間隔に配置（ヘッダーの「整列」）
- 保存/読込: ブラウザローカル保存、TOMLファイルの入出力
- 画像出力: キャンバスを PNG としてダウンロード

データモデル/スキーマ
- 内部 JSON 形式（シリアライズ）: `schemas/serialized-graph.v1.schema.json`
- TOML ファイルの論理構造（JSON 表現）: `schemas/whyboard-toml.v1.schema.json`
  - TOML ↔ JSON は `lib/boardIO.ts` の `toToml`/`fromToml` に準拠
  - 将来の移行のために `version` を付ける運用を推奨

クイックスタート
前提: Node.js 18+（推奨 20）

```
cd whywhybord
npm install
npm run dev
# http://localhost:3000/boards/dev を開く
```

本番ビルド/起動
```
cd whywhybord
npm run build
npm run start
# 既に 3000 番使用中なら別ポートで: npm run start -- -p 3001
```

補足: 開発ビルドは `.next-dev/`、本番ビルドは `.next/` に出力されます（`next.config.mjs` で分離）。

使い方のヒント
- 右ハンドルをドラッグして空白にドロップすると子ノードを自動追加します。
- 右クリックでメニューが開き、「なぜ」「原因」「対策」の追加や削除ができます。
- ヘッダーのボタン
  - 一時保存/一時読込: ブラウザに TOML を保存/復元
  - ファイル出力/読込: TOML のダウンロード/アップロード
  - PNG書き出し: 現在の図を画像として保存
  - クリア/整列/画面フィット: 図の初期化、再レイアウト、全体表示

よくある問題と対処
- ポートが使用中: EADDRINUSE :3000 → 既存の dev を停止、または `-p` でポート変更
- 本番起動で「ビルドが無い」: `rm -rf .next && npm run build && npm run start`
- HMR の 404: `*.hot-update.json 404` は一時的なもので無害です

ライセンス
このリポジトリのライセンスはプロジェクト方針に従います（明示が無い場合は私的利用前提）。
