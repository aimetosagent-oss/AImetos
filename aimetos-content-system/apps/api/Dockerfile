FROM node:24-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --prod --frozen-lockfile
EXPOSE 4317
CMD ["node", "apps/api/src/server.ts"]
