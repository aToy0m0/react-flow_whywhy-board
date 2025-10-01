# 📘 README_DOCKER.md

## プロジェクト概要
**WhyWhy Board** - なぜなぜ分析を複数ユーザーがリアルタイムで協働できるブラウザアプリです。

このディレクトリには、**Next.js アプリを Docker 上で実行するための設定**が含まれています。
他の人は `git clone` → `docker compose up -d` だけでアプリを起動できます。

### 主な機能
- 🎨 ビジュアルなフローチャート編集（React Flow）
- 🔄 リアルタイム協働編集（Socket.IO）
- 🔒 ノードロック機能による競合回避
- 💾 PostgreSQL + Prisma ORMによるデータ永続化
- 🔐 NextAuth.jsによる認証
- 📤 PNG/SVG画像エクスポート
- 🔍 柔軟なズーム機能（10%～400%）

### 最新リリース: v1.0.1 (2025-10-01)
- ✨ SVG書き出し機能（ベクター形式、z-index保持）
- 🔍 ズーム範囲拡張（minZoom: 0.1, maxZoom: 4）
- ✅ 採用チェックのDB保存修正
- 🔒 ロック解除タイマーの改善
- 💾 テキスト保存の確実化

---

## 前提条件
- Docker がインストールされていること  
- Docker Compose v2 以上が利用可能であること  

---

## 構成ファイル
- `dockerfile` … Next.js アプリをビルドして実行する Dockerfile  
- `docker-compose.yml` … コンテナ起動を簡略化する Compose 設定  
- `.dockerignore` … ビルド不要ファイルを除外する設定  
- `app/`, `components/`, `public/` など … Next.js ソースコード  

---

## 必須環境変数
`.env` あるいは `docker-compose.yml` の `environment` セクションで以下を設定します。

| 変数 | 用途 | 例 |
| ---- | ---- | -- |
| `DATABASE_URL` | Prisma / アプリの DB 接続文字列 | `postgresql://whyboard:whyboard@db:5432/whyboard` |
| `NEXTAUTH_URL` | NextAuth.js の認証 URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth.js のセッション暗号化キー | `your-secret-key-here` |
| `SUPERADMIN_EMAIL` | スーパー管理者のメールアドレス | `admin@example.com` |
| `SUPERADMIN_PASSWORD` | スーパー管理者のパスワード | `your-password` |
| `NEXT_PUBLIC_TENANT_ID` | テナント識別子（任意） | `default` |
| `NEXT_PUBLIC_API_BASE_URL` | フロントからの API ベース URL（任意） | `http://localhost:3000` |
| `NEXT_PUBLIC_REPO_URL` | ドキュメント参照用のリポジトリ URL（任意） | `https://github.com/your-org/your-repo/blob/main` |

Dockerfile にも既定値が入っていますが、実環境では `.env` で上書きしてください。

### NextAuth設定の重要な注意点
- `NEXTAUTH_URL` は実際にアクセスするURLと一致させる必要があります
  - ローカル: `http://localhost:3000`
  - LAN内: `http://192.168.x.x:3000`
  - 本番: `https://your-domain.com`
- `NEXTAUTH_SECRET` は以下のコマンドで生成できます:
  ```bash
  openssl rand -base64 32
  ```

---

## 初回セットアップ

リポジトリのルート（`yy-board_nextjs/whywhybord`）で以下を実行します。

1. **アプリと DB をビルド・起動**
   ```bash
   docker compose up -d --build
   ```

2. **Prisma マイグレーションの適用**（DB スキーマ生成）
   ```bash
   docker compose exec web npx prisma migrate deploy
   ```

3. **Prisma クライアントの再生成（任意）**
   ```bash
   docker compose exec web npx prisma generate
   ```

4. **アプリの再起動**
   ```bash
   docker compose restart web
   ```

5. **スーパー管理者の初期化**
   ```bash
   curl -X POST http://localhost:3000/api/init
   ```
   `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` が既に存在する場合は `created: false` が返ります。

6. **動作確認**
   - ブラウザで `http://localhost:3000/login` を開き、以下でサインインします。
     - ユーザー: `SUPERADMIN_EMAIL`（既定は `admin@example.com`）
     - パスワード: `SUPERADMIN_PASSWORD`（`.env` に設定した値）
   - サインイン後、`http://localhost:3000/default/board/MVP` を確認してください。

> **Note:** DB ボリュームを削除した場合は、再度ステップ 2 以降を実行し、最後に `/api/init` を叩いてください。`docker compose exec db psql -U whyboard -d whyboard -c '\dt'` でテーブルが存在するか確認できます。

---

## よくある操作

### コンテナの停止
```bash
docker compose down
```

### ログの確認
```bash
docker compose logs -f web
```

### コンテナの再起動
```bash
docker compose restart web
```

### コンテナの再ビルド
```bash
docker compose up -d --build
```

### Prismaマイグレーション適用
```bash
docker compose exec web npx prisma migrate deploy
```

### データベース確認
```bash
docker compose exec db psql -U whyboard -d whyboard -c '\dt'
```

### 起動ポリシーの確認
```bash
docker ps -a --format '{{.Names}}' | xargs -n1 docker inspect -f '{{.Name}}: {{.HostConfig.RestartPolicy.Name}}'
```

### 自動起動を設定する方法
既存のコンテナに対して：
```bash
docker update --restart=always <CONTAINER ID>
```

docker-compose.yml で定義する場合：
```yml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    restart: always
```

選択肢：
```yml
restart: "no"            # 自動再起動しない（デフォルト）
restart: always          # 常に再起動
restart: unless-stopped  # 手動停止時は再起動しない（実用上これが一番便利）
restart: on-failure      # 異常終了時のみ再起動（回数制限も可）
restart: on-failure:5    # 最大5回まで再起動
```

---

## 開発向けヒント

- ホットリロードを使いたい場合は、`docker-compose.override.yml` を作成し、
  ボリュームマウントして `npm run dev` を利用することも可能です。
- 開発時の例：

```yaml
version: "3.9"
services:
  web:
    build: .
    command: npm run dev
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "3000:3000"
```

---

## 注意点
- `node_modules` や `.next` は `.dockerignore` により除外されます。  
  依存関係インストールとビルドは **Docker 内で自動実行**されます。  
- 開発用途でホットリロードを使いたい場合は `npm run dev` を直接実行してください（Dockerfile は本番向け構成です）。  
- 環境変数を使う場合は `.env` ファイルを用意し、`docker-compose.yml` に追記してください。  

---

## トラブルシューティング

### ビルドが失敗する場合
- Node.js のバージョンを確認してください（Dockerfile は `node:20-alpine` を使用）。  
- `package-lock.json` が壊れている場合は削除して再度 `docker compose build` を実行してください。  
- Prisma スキーマが見つからない場合は、`dockerfile` に `COPY --chown=node:node --from=builder /app/prisma ./prisma` が含まれていることと、`npx prisma generate --schema prisma/schema.prisma` を実行済みであることを確認してください。

### ポート競合がある場合
- すでにポート `3000` を使っているアプリがあると起動できません。  
- `docker-compose.yml` の `ports` を修正してください。

```yaml
ports:
  - "8080:3000"
```

その場合はブラウザで `http://localhost:8080` を開いてください。  

---

## 将来的な拡張

- Nginx を追加して静的ファイル配信専用にすることも可能です。  
- PostgreSQL や Redis を追加したい場合は `docker-compose.yml` に追記してマルチサービス構成にできます。  
- CI/CD（GitHub Actions など）と組み合わせれば、自動デプロイも可能です。マイグレーションは `docker compose run --rm web npx prisma migrate deploy --schema prisma/schema.prisma` を組み込むと安全です。  

---
