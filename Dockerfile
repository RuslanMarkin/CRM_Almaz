FROM node:22-alpine AS dependencies

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime

RUN corepack enable
WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3000

CMD ["pnpm", "start"]
