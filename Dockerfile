# COS Graph Engine — Dockerfile
# Multi-stage build: builder → runner
# Zero external dependencies, full monorepo

# ============================================================
# Stage 1: Builder
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /build

# Copy monorepo root and frozen dependency graph
COPY package.json ./
COPY package-lock.json ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./

# Copy all package.json for workspace dependency resolution
COPY packages/core/package.json packages/core/
COPY packages/runtime/package.json packages/runtime/
COPY packages/memory/package.json packages/memory/
COPY packages/knowledge/package.json packages/knowledge/
COPY packages/cognition/package.json packages/cognition/
COPY packages/execution/package.json packages/execution/
COPY packages/orchestration/package.json packages/orchestration/
COPY packages/observability/package.json packages/observability/
COPY packages/api/package.json packages/api/
COPY packages/infrastructure/package.json packages/infrastructure/
COPY packages/deployment/package.json packages/deployment/
COPY packages/graph/package.json packages/graph/
COPY packages/visualization/package.json packages/visualization/

# Copy WASM package (package manifest + AssemblyScript sources/config)
COPY packages/wasm/ packages/wasm/

# Frozen reproducible install. Build tooling is required in the builder stage.
RUN npm ci --include=dev

# Copy source code
COPY packages/core/src/ packages/core/src/
COPY packages/runtime/src/ packages/runtime/src/
COPY packages/memory/src/ packages/memory/src/
COPY packages/knowledge/src/ packages/knowledge/src/
COPY packages/cognition/src/ packages/cognition/src/
COPY packages/execution/src/ packages/execution/src/
COPY packages/orchestration/src/ packages/orchestration/src/
COPY packages/observability/src/ packages/observability/src/
COPY packages/api/src/ packages/api/src/
COPY packages/infrastructure/src/ packages/infrastructure/src/
COPY packages/deployment/src/ packages/deployment/src/
COPY packages/graph/src/ packages/graph/src/
COPY packages/visualization/src/ packages/visualization/src/

# WASM is a required production artifact. Never hide a compiler failure.
RUN npm run asbuild

# Build TypeScript
RUN npx tsc -p tsconfig.build.json --outDir /dist

# ============================================================
# Stage 2: Runner
# ============================================================
FROM node:22-alpine

RUN apk add --no-cache tini

WORKDIR /cos

# Copy compiled output
COPY --from=builder /dist /cos/dist
COPY --from=builder /build/node_modules /cos/node_modules
COPY --from=builder /build/package.json /cos/package.json
COPY --from=builder /build/packages/wasm/build/ /cos/packages/wasm/build/

# Environment
ENV NODE_ENV=production
ENV PORT=8080
ENV COS_GRAPH_ENGINE_VERSION=2.1.0

# Expose HTTP API + Dashboard + Telemetry
EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/packages/api/src/server.js"]
