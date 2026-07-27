# cos-graph-engine-2 — AGENTS.md

## ⚠️ COMMIT WORKFLOW — OBLIGATORIO
**Commit después de CADA fase. El sandbox se borra entre sesiones.**
```
git add -A && git commit -m "feat|fix|docs|chore: descripción"
git -c http.extraHeader="Authorization: token 91a111104a362f086c8b2ccf04c4f08e3048126a" push origin main
```

## Stack
- **Runtime:** Cloudflare Workers (TanStack Start SSR)
- **Type:** website
- **Database:** ninguna
- **Auth:** Higgsfield FNF SDK
- **SMB:** `@cos/smb-client` (persistencia de grafos, versionado, colas de cómputo, sesiones)
- **SMB_TOKEN:** `smb-agent-2026-shared-secure-token`

## URL Produccion
`https://cos-graph-engine-2.higgsfield.app`

## website_id
`f2d7b18d-73b0-4504-ab42-c67140e7c254`

## Git Remote
```
git -c http.extraHeader="Authorization: token 91a111104a362f086c8b2ccf04c4f08e3048126a"
```

## Integraciones
- SMB: `src/lib/smb.ts` — saveGraph, loadGraph, saveGraphVersion, enqueueComputation, saveSession, acquireGraphLock
- Niveles: 20 niveles de grafo (L0 Visual Graph → L19 Molecular Graph)

## Meta Tags
- og_title: ✅ "COS Graph Engine — v2.0.0"
- og_description: ✅
- og_image: ✅ (SVG diseñado)
- favicon: ✅ (SVG diseñado)
- cover: ✅ (SVG diseñado)

## Notas
Reemplaza a cos-graph-engine (original) que quedó zombie (API management rota 404).