# 📘 README_DOCKER.md

## プロジェクト概要
このディレクトリには、**Next.js アプリを Docker 上で実行するための設定**が含まれています。  
他の人は `git clone` → `docker compose up -d` だけでアプリを起動できます。  

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
| `BASIC_AUTH_USER` | Basic 認証ユーザー名 | `admin@example.com` |
| `BASIC_AUTH_PASSWORD` | Basic 認証パスワード | `changeme` |
| `NEXT_PUBLIC_TENANT_ID` | テナント識別子 | `default` |
| `NEXT_PUBLIC_API_BASE_URL` | フロントからの API ベース URL | `http://localhost:3000` |
| `NEXT_PUBLIC_REPO_URL` | ドキュメント参照用のリポジトリ URL（任意） | `https://github.com/your-org/your-repo/blob/main` |

Dockerfile にも既定値が入っていますが、実環境では `.env` で上書きしてください。

---

## 初回セットアップ

リポジトリのルート（`yy-board_nextjs/whywhybord`）で以下を実行します。

1. **Docker ネットワークと DB の起動**
   ```bash
   docker compose up -d db
   ```

2. **Prisma マイグレーションの適用**（DB スキーマ生成）
   ```bash
   docker compose run --rm \
     -v "$(pwd)/prisma:/app/prisma" \
     web npx prisma migrate dev --name init --schema prisma/schema.prisma
   ```

3. **Prisma クライアントの生成**
   ```bash
   docker compose run --rm \
     -v "$(pwd)/prisma:/app/prisma" \
     web npx prisma generate --schema prisma/schema.prisma
   ```

4. **アプリ本体のビルド & 起動**
   ```bash
   docker compose up -d --build
   ```

5. **動作確認**
   ブラウザで `http://localhost:3000` にアクセスし、Basic 認証を通過できれば成功です。

> **Note:** 既に DB ボリュームが存在する場合はマイグレーションのみを再実行してください。`DATABASE_URL` が `postgresql://...@db:5432/...` になっていれば `web` コンテナから `db` に接続できます。

---

## よくある操作

### コンテナの停止
```bash
docker compose down
```

### ログの確認
```bash
docker compose logs -f
```

### コンテナの再ビルド
```bash
docker compose up -d --build
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
