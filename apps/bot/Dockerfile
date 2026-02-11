FROM node:24-bookworm
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/bot/package.json apps/bot/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install

COPY apps/bot apps/bot
COPY packages/shared packages/shared

RUN pnpm -C apps/bot build

EXPOSE 3004
CMD ["pnpm", "-C", "apps/bot", "start"]
