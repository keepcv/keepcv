# syntax=docker/dockerfile:1
FROM node:26-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1 AS build
ENV TURBO_TELEMETRY_DISABLED=1
WORKDIR /src
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
RUN mkdir /packages && pnpm -r --filter './packages/**' --filter @keepcv/cli pack --pack-destination /packages

FROM scratch AS packages
COPY --from=build /packages/ /

FROM node:26-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1 AS install
WORKDIR /app
COPY --from=packages / /packages/
COPY scripts/container-install.mjs /container-install.mjs
RUN node /container-install.mjs

FROM node:26-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1 AS runtime
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
