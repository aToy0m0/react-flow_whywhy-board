# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# package.json だけ先にコピーして依存をキャッシュ
COPY package*.json ./
RUN npm install --frozen-lockfile

# ソースをコピーしてビルド
COPY . .
RUN npm run build

# --- Run Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

# 本番に必要なファイルだけコピー
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["npm", "start"]
