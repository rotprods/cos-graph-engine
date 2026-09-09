# COS Graph Engine — production container
# Reproducible multi-stage build with compiled workspace packages only at runtime.

ARG NODE_IMAGE=node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32

FROM ${NODE_IMAGE} AS builder
WORKDIR /build

COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./

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
COPY packages/wasm/ packages/wasm/

RUN npm ci --include=dev --ignore-scripts --no-audit --no-fund

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

# Required native artifact and fail-closed TypeScript production build.
RUN npm run asbuild
RUN npx --no-install tsc -p tsconfig.build.json --outDir /dist

# Materialize workspace-local dist directories so npm workspace links remain valid
# after the builder filesystem is gone. Version-2 packages historically pointed
# `main` at TypeScript source; the container consumes the compiled entrypoint.
RUN node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const packages = [
  'core', 'runtime', 'memory', 'knowledge', 'cognition', 'execution',
  'orchestration', 'observability', 'api', 'infrastructure', 'deployment',
  'graph', 'visualization', 'wasm',
];
for (const name of packages) {
  const from = path.join('/dist/packages', name, 'src');
  const to = path.join('/build/packages', name, 'dist');
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}
for (const name of ['observability', 'graph', 'visualization', 'wasm']) {
  const manifestPath = path.join('/build/packages', name, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.main = 'dist/index.js';
  manifest.types = 'dist/index.d.ts';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
NODE

# Runtime dependency graph only. Workspace links are intentionally retained and
# now target copied package directories containing compiled dist output.
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM ${NODE_IMAGE} AS runner
RUN apk add --no-cache tini=0.19.0-r3
WORKDIR /cos

COPY --from=builder --chown=node:node /build/node_modules ./node_modules
COPY --from=builder --chown=node:node /build/packages ./packages
COPY --from=builder --chown=node:node /build/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=8080
ENV COS_GRAPH_ENGINE_VERSION=2.1.0

EXPOSE 8080

# Public health is deliberately unauthenticated; protected routes remain gated.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "packages/deployment/dist/serve.js"]
