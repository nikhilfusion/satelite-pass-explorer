# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Orbit Explorer — single image serving the API *and* the built SPA.
#   docker build -t orbit-explorer .
#   docker run -p 3000:3000 -v $PWD/data:/data/source:ro -v orbit-db:/data/db orbit-explorer
# The DuckDB file is built on first boot from the mounted GeoJSON (≈5 s) and persisted in /data/db.
# ---------------------------------------------------------------------------
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# --- 1. install all dependencies (cached while manifests are unchanged) -----
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contract/package.json packages/contract/
RUN --mount=type=cache,target=/root/.npm npm ci

# --- 2. build web + api bundles --------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages packages
COPY apps apps
RUN npm run build

# --- 3. production-only node_modules (native DuckDB bindings included) ------
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contract/package.json packages/contract/
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace @sat/api

# --- 4. runtime --------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DB_PATH=/data/db/tracks.duckdb \
    GEOJSON_PATH=/data/source/Altair-2P5S-tracks-1w.json \
    WEB_DIST=/app/apps/web/dist

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY apps/api/package.json ./apps/api/package.json

RUN mkdir -p /data/db /data/source && chown -R node:node /data
USER node
VOLUME ["/data/db"]
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
