FROM node:24-bookworm
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/storefront/package.json apps/storefront/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install

COPY apps/storefront apps/storefront
COPY packages/shared packages/shared
COPY packages/ui packages/ui

RUN pnpm -C apps/storefront build

EXPOSE 3003
CMD ["pnpm", "-C", "apps/storefront", "start"]
