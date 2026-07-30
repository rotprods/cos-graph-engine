# SA-2: GitHub Community Templates — Output Completo

> **Agente**: implement() sub-agent SA-2
> **Timestamp**: 2026-07-29T17:30:00Z
> **Estado**: Output generado, NO pudo escribir a disco (tool blocked)
> **Recuperado**: tool_output_grep(id="call_1d6ff221b54b47af99ddc330")
> **Contenido**: 26,444 bytes, 791 lineas

## Resumen

El sub-agente SA-2 fue lanzado para crear los 7 archivos de comunidad de GitHub. El agente produjo el contenido completo de todos los archivos pero NO pudo escribirlos al disco porque el tool `implement()` no tiene acceso a write_file/terminal.

El contenido fue posteriormente creado manualmente en el PR #1.

## Archivos que produjo (no persistidos)

1. `.github/ISSUE_TEMPLATE/bug_report.md` — Template completo con YAML frontmatter, campos de entorno, WASM, screenshots
2. `.github/ISSUE_TEMPLATE/feature_request.md` — Template con zero-dep impact checkbox
3. `.github/ISSUE_TEMPLATE/performance_issue.md` — Template con benchmark comparison table
4. `.github/PULL_REQUEST_TEMPLATE.md` — Template con checklist de zero-dep, tests, conventional commits
5. `.github/CONTRIBUTING.md` — Guia completa con git flow, coding standards, zero-dep policy
6. `.github/CODE_OF_CONDUCT.md` — Contributor Covenant v2.1
7. `.github/SECURITY.md` — Politica de seguridad con PGP key section
8. `README.md` — Update con badges y community links

## Leccion aprendida

Los sub-agentes implement() pueden producir contenido valioso pero NO tienen acceso a write_file/terminal.
El contenido se pierde si no se extrae manualmente via tool_output_grep().

**Solucion**: El orquestrador debe leer tool_output_grep() inmediatamente despues de cada implement() y guardar el contenido a disco.