# syntax=docker/dockerfile:1

# 依存取得ステージ
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# ビルドステージ
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG DATABASE_URL=postgresql://whyboard:whyboard@db:5432/whyboard
ENV DATABASE_URL=${DATABASE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

# 実行ステージ
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ARG DATABASE_URL=postgresql://whyboard:whyboard@db:5432/whyboard
ENV DATABASE_URL=${DATABASE_URL}

# node ユーザーで実行（ベースイメージ同梱）
USER node

# 実行に必要な成果物のみコピー
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node --from=builder /app/.next ./.next
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/server.js ./server.js

EXPOSE 3000
CMD ["npm", "start"]
