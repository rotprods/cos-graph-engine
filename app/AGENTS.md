# cos-graph-engine-2 — AGENTS.md

## ╔══════════════════════════════════════════════════════════════╗
## ║    🚨 COMMIT WORKFLOW — ORDEN ESTRICTA — OBLIGATORIO       ║
## ╚══════════════════════════════════════════════════════════════╝

### REGLA DE ORO: COMMIT DESPUÉS DE CADA IMPLEMENTACIÓN.

### ORDEN ESTRICTA:
### 1. write_file / patch  2. git add -A  3. git commit  4. fetch
### 5. rebase  6. push  7. deploy

```bash
git add -A && git commit -m "tipo: descripción"
git -c http.extraHeader="Authorization: token 91a111104a362f086c8b2ccf04c4f08e3048126a" fetch origin
git -c http.extraHeader="Authorization: token 91a111104a362f086c8b2ccf04c4f08e3048126a" rebase origin/main
git -c http.extraHeader="Authorization: token 91a111104a362f086c8b2ccf04c4f08e3048126a" push origin main
```

## Stack
- **Runtime:** Cloudflare Workers (TanStack Start SSR) | **Type:** website
- **SMB:** `@cos/smb-client` (persistencia grafos, versionado, colas, sesiones)
- **SMB_TOKEN:** `smb-agent-2026-shared-secure-token`

## URL / website_id
`https://cos-graph-engine-2.higgsfield.app` / `f2d7b18d-73b0-4504-ab42-c67140e7c254`

## Git Remote
```bash
git -c http.extraHeader="Authorization: token 91a111104a362f086c8b2ccf04c4f08e3048126a"
```

## Notas
Reemplaza a cos-graph-engine (original) que quedó zombie (API management rota 404).