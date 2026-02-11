FROM node:24-bookworm
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install

COPY apps/admin apps/admin
COPY packages/shared packages/shared
COPY packages/ui packages/ui

RUN pnpm -C apps/admin build

EXPOSE 3002
CMD ["pnpm", "-C", "apps/admin", "start"]
