# WhyWhy Board

なぜなぜ分析（5 Whys）を行うためのWebアプリケーション。組織単位でユーザーを管理し、ボードを共有できる。

## 機能

- ノードベースのビジュアル分析エディタ
- ドラッグ&ドロップによるノード作成・編集
- Root、Why、Cause、Actionノードによる分析構造化
- PNG形式での図の出力
- 組織（テナント）単位でのユーザー管理
- 3段階のユーザー権限（SUPER_ADMIN、TENANT_ADMIN、MEMBER）
- TOML形式でのデータインポート・エクスポート

## 技術スタック

- Next.js 14 (App Router)
- React 18
- TypeScript
- PostgreSQL
- Prisma ORM
- NextAuth.js
- React Flow v12
- Tailwind CSS

## セットアップ

### 前提条件
- Node.js 18以上
- Docker & Docker Compose

### 開発環境
```bash
cd whywhybord
npm install

# 環境変数設定
cp .env.example .env

# NextAuth用のシークレットキー生成
openssl rand -base64 32

# .envファイルにNEXTAUTH_SECRETを設定
# NEXTAUTH_SECRET=<生成されたキー>

# データベース起動
docker-compose up -d

# マイグレーション実行
npx prisma migrate dev

# 開発サーバー起動
npm run dev
```

### Docker本番環境
```bash
cd whywhybord

# 環境変数設定
cp .env.example .env
# .envファイルを編集（DATABASE_URL、NEXTAUTH_SECRET等）

# アプリケーションビルド・起動
docker compose up -d --build

# マイグレーション実行
docker compose exec web npx prisma migrate deploy

# Prismaクライアント生成（任意）
docker compose exec web npx prisma generate

# アプリケーション再起動
docker compose restart web
```

### 初回セットアップ
1. http://localhost:3000/setup でスーパーアドミンユーザーを作成
2. テナントを作成
3. ユーザーを招待

## ユーザー権限

### SUPER_ADMIN
- 全テナントの管理
- システム設定の変更

### TENANT_ADMIN
- 自テナント内のユーザー管理
- テナント設定の変更

### MEMBER
- ボードの作成・編集
- 自分の情報の変更

## 基本操作

### ノード操作
- 右ハンドルを空白にドラッグしてノード追加
- 右クリックでメニュー表示（追加・削除）
- ダブルクリックでテキスト編集

### ボード管理
- 自動保存
- TOML形式でエクスポート・インポート
- PNG画像として出力

## データベーススキーマ

主要なテーブル:
- `Tenant` - 組織情報
- `User` - ユーザー情報とロール
- `Board` - なぜなぜ分析ボード
- `Node` - 分析ノード

詳細は `prisma/schema.prisma` を参照。

## トラブルシューティング

### ポート使用中
```bash
# 他のプロセスを停止するか、別ポートで起動
npm run dev -- -p 3001
```

### データベース接続エラー
```bash
# PostgreSQLコンテナの起動確認
docker-compose ps
docker-compose up -d
```

## License

MIT License
