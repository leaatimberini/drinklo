FROM node:24-bookworm
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json

RUN pnpm install

COPY packages/db packages/db
COPY apps/api apps/api

RUN pnpm -C packages/db generate
RUN pnpm -C packages/db build
RUN pnpm -C apps/api build

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
