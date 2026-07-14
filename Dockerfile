# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat openssl

FROM base AS dependencies

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev

FROM base AS builder

ARG DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
ARG DIRECT_DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
ARG SHADOW_DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build_shadow?schema=public
ARG AUTH_SECRET=build-only-placeholder-never-used-at-runtime-000000000000
ARG APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

ENV DATABASE_URL=${DATABASE_URL} \
    DIRECT_DATABASE_URL=${DIRECT_DATABASE_URL} \
    SHADOW_DATABASE_URL=${SHADOW_DATABASE_URL} \
    AUTH_SECRET=${AUTH_SECRET} \
    APP_URL=${APP_URL} \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM base AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apk add --no-cache dumb-init \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

# The web process uses Next.js' standalone server. The complete dependency tree
# is intentionally retained because the same image also executes Prisma deploys,
# seeds, and the PostgreSQL-backed worker from the same immutable image.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/docker ./docker

RUN chmod +x ./docker/entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--", "./docker/entrypoint.sh"]
CMD ["app"]
