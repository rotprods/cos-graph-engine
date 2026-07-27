# cos-graph-engine-2 — AGENTS.md

## ⚠️ COMMIT WORKFLOW
Commit después de CADA fase. El sandbox se borra entre sesiones. Si no hay commit, se pierde el trabajo.

## Stack
- **Runtime:** Cloudflare Workers (TanStack Start SSR)
- **SMB:** `@cos/smb-client` para persistencia de grafos, versionado, colas de cómputo, sesiones
- **SMB_TOKEN:** `smb-agent-2026-shared-secure-token` (seteado en website_secrets)

## URL Produccion
`https://cos-graph-engine-2.higgsfield.app`

## website_id
`f2d7b18d-73b0-4504-ab42-c67140e7c254`

## Nota
Este sitio reemplaza a cos-graph-engine (original), que quedó zombie (API management rota 404).

## Integraciones
- **SMB:** `src/lib/smb.ts` — saveGraph, loadGraph, saveGraphVersion, enqueueComputation, saveSession, acquireGraphLock
- **Niveles:** 20 niveles de grafo (L0-L19)

## Meta Tags
- og_title: ✅
- og_description: ✅
- og_image: ✅ (SVG diseñado)
- favicon: ✅ (SVG diseñado)
- cover: ✅ (SVG diseñado)

## Repo
- `git -c http.extraHeader="Authorization: token 91a111104a362f086c8b2ccf04c4f08e3048126a"`