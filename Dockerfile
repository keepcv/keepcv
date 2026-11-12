# syntax=docker/dockerfile:1
FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS build
ENV TURBO_TELEMETRY_DISABLED=1
WORKDIR /src
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
RUN mkdir /packages && pnpm -r --filter './packages/**' --filter @keepcv/cli pack --pack-destination /packages

FROM scratch AS packages
COPY --from=build /packages/ /

FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS install
WORKDIR /app
COPY --from=packages / /packages/
COPY scripts/container-install.mjs /container-install.mjs
RUN node /container-install.mjs

FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS runtime
LABEL org.opencontainers.image.source="https://github.com/keepcv/keepcv"
LABEL org.opencontainers.image.description="Career data store that compiles into resumes"
LABEL org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production
ENV KEEPCV_DATA_DIR=/data KEEPCV_PORT=4319 KEEPCV_HOST=0.0.0.0 KEEPCV_AUTH=password KEEPCV_ORIGIN=http://localhost:4319
WORKDIR /app
COPY --from=install /app/ /app/
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4319
ENTRYPOINT ["node", "/app/node_modules/@keepcv/cli/dist/index.js"]
CMD ["serve"]
