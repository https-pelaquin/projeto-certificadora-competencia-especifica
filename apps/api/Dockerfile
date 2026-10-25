FROM node:24-bookworm-slim

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api

# Chromium do Playwright gera o relatório em PDF.
RUN pnpm --filter api exec playwright install --with-deps chromium

COPY apps/api apps/api
WORKDIR /app/apps/api
RUN pnpm db:generate

EXPOSE 3000
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
