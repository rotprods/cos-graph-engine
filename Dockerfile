# Phase 5: COS Production Dockerfile
# Multi-stage build: builder → runner

FROM node:22-alpine AS builder
WORKDIR /build
COPY package.json ./
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
RUN npm install --omit=dev
COPY . .
RUN npx tsc -p tsconfig.build.json --outDir /dist

# Runtime stage
FROM node:22-alpine
RUN apk add --no-cache tini
WORKDIR /cos
COPY --from=builder /dist /cos/dist
COPY --from=builder /build/node_modules /cos/node_modules
COPY --from=builder /build/package.json /cos/package.json
ENV NODE_ENV=production
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/packages/deployment/src/bootstrap.js"]