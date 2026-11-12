# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS build
ENV TURBO_TELEMETRY_DISABLED=1
WORKDIR /src
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
RUN mkdir /packages && pnpm -r --filter './packages/**' --filter @keepcv/cli pack --pack-destination /packages

FROM scratch AS packages
COPY --from=build /packages/ /

FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS install
WORKDIR /app
COPY --from=packages / /packages/
COPY scripts/container-install.mjs /container-install.mjs
RUN node /container-install.mjs

FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS runtime
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
