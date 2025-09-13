Development Guide (whywhybord)

このドキュメントは開発者向けです。開発環境、コード構成、主要な実装方針、トラブルシュートをまとめています。

環境要件
- Node.js 18+（推奨 20）
- npm 9 以上

セットアップ
```
cd whywhybord
npm install
npm run dev   # http://localhost:3000
```

ビルド出力の分離
- 開発: `.next-dev/`
- 本番: `.next/`
`next.config.mjs` でフェーズ別の `distDir` を設定済みです。

スクリプト
- `npm run dev` 開発サーバ（HMR）
- `npm run build` 本番ビルド（型チェック/最適化込み）
- `npm run start` 本番起動（`.next/` を使用）

ディレクトリ構成（主なもの）
- `whywhybord/app/` Next.js App Router のルーティング
- `whywhybord/components/` UI コンポーネント（React Flow ノード含む）
- `whywhybord/lib/` 盤面I/O、レイアウト、定数などのロジック
- `whywhybord/hooks/` カスタムフック（コンテキストメニュー等）
- `docs/` 仕様や作業メモ

技術スタック
- Next.js 14（App Router）
- React 18
- @xyflow/react v12（旧 React Flow）
- Tailwind CSS
- html-to-image（PNG エクスポート）
- @iarna/toml（TOML I/O）

React Flow 実装方針
- 状態: `useNodesState` / `useEdgesState` を使用
- エッジ型: `whywhybord/lib/layoutConstants.ts` の `EDGE_TYPE`（既定は `simplebezier`）
- エッジ共通設定: `defaultEdgeOptions`（矢印 `MarkerType.ArrowClosed` など）
- 接続: `connectionMode` は `Strict`。ハンドル→空白ドロップで子ノードを自動追加
- レイアウト: `lib/boardLayout.ts` の `computeLayoutForParent` で等間隔配置

ノード/エッジの型
- `components/boardTypes.ts` に `WhyNodeData`（UI 用コールバック、状態）を定義
- ノードコンポーネント: `components/WhyNode.tsx`（右クリックメニュー、採用トグル、入出力ハンドル）

ボードの保存/読み込み（TOML）
- 実装: `lib/boardIO.ts`
- シリアライズ: `toToml(boardId, nodes, edges)` → TOML 文字列
- デシリアライズ: `fromToml(text)` → `{ nodes, edges }`
- `deserializeGraph` で `enhanceNode` を通し、ノードにコールバックや補助関数を注入

PNG エクスポート
- 実装: `components/WhyBoardCanvas.tsx` の `exportPng`
- 現在のビューポートを保存 → `fitBounds` で全体表示 → `.react-flow__viewport` を `html-to-image` でキャプチャ → ビューポート復元
- 余白は `fitBounds({ padding })`、解像度は `pixelRatio` で調整

開発上の注意
- dev と prod を同時起動しない（`.next-dev/` と `.next/` の衝突やポート競合）
- ポート競合時: `npm run start -- -p 3001` などで回避
- HMR の 404 は一時的で無害（フルリロード後に消える）
- 既知の警告: v12 では `bezier` 型はビルトインでなく、`simplebezier`/`smoothstep` を使用

コーディング規約（簡易）
- TypeScript: 可能な範囲で型注釈を付与
- ファイル分割: UI（components）とロジック（lib）を分離
- 命名: 関数/変数は lowerCamelCase、型/コンポーネントは UpperCamelCase

今後（予定）
- DB/ORM: PostgreSQL + Prisma（`.env` に `DATABASE_URL` を定義）
- コンテナ: Docker / docker-compose（`.dockerignore` 推奨）
- マイグレーション: Prisma Migrate（`prisma/migrations/` を追跡）

トラブルシュート
- 本番起動で「ビルドが無い」: `rm -rf .next && npm run build && npm run start`
- d3 vendor-chunks 参照エラー: `.next` を削除して再ビルド（dev/prod 混在解消）
- 型エラー（NodeChange 等）: `@xyflow/react` v12 の型に合わせて `NodeProps<RFNode<WhyNodeData>>` を使用

参考リンク
- React Flow (XYFlow): https://reactflow.dev/
