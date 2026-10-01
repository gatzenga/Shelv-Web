# The base image is named by its digest, so a build is the same build tomorrow.
# Dependabot proposes the new one (.github/dependabot.yml).
# Build stage: frontend. The result is plain files, so it is built once on
# the machine doing the build and used for every platform of the image.
FROM --platform=$BUILDPLATFORM node:26-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80 AS build

WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack install
ENV PNPM_CONFIG_IGNORE_SCRIPTS=true
RUN pnpm install --ignore-scripts
COPY . .
RUN pnpm run build

# Final stage: one Node.js process serves the frontend and runs the backend.
# The backend has no dependencies, Node.js runs the TypeScript files directly.
FROM node:26-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    DIST_DIR=/app/dist \
    CACHE_DIR=/cache \
    CONFIG_DIR=/config \
    LOGS_DIR=/logs

COPY --from=build /app/dist ./dist
COPY server ./server
RUN mkdir -p /cache /config /logs

EXPOSE 8080
VOLUME ["/cache", "/config", "/logs"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1

# Like Navidrome: no entrypoint script, no chmod, no chown. The process runs as
# the user of the compose file and creates its files with the defaults, so
# they get the rights of the mounted folder.
ENTRYPOINT ["node", "server/index.ts"]
