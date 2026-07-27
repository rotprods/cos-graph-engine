# COS Quick Start Guide

## Prerequisites

- **Node.js 18+** (verify: `node --version`)
- **npm 9+** (verify: `npm --version`)
- **Git** (optional, for cloning)

## Installation

### Option 1: Clone and setup

```bash
# Clone the repository
git clone <repo-url> cos
cd cos

# Run the setup script
bash scripts/setup-and-launch.sh
```

### Option 2: Manual setup

```bash
cd cos
npm install
npm install --no-save tsx
```

## Configuration

Copy `.env` from the template or set environment variables:

```bash
# Basic settings
export COS_HOST=0.0.0.0
export COS_PORT=8080
export COS_LOG_LEVEL=info
export COS_JWT_SECRET=your-secret-here
export COS_DATA_DIR=./.cos-data

# Optional: Real AI via OpenAI
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o-mini
```

Or create a `.env` file (auto-loaded):

```env
COS_HOST=0.0.0.0
COS_PORT=8080
COS_LOG_LEVEL=info
COS_JWT_SECRET=change-this-in-production
COS_DATA_DIR=./.cos-data
```

## First Launch

### Full system (recommended)

```bash
npm start
```

This will:
1. Initialize all 11 subsystems
2. Register 2 cognitive cells
3. Define 2 agents
4. Populate demo data (memory, knowledge graph, ontology)
5. Run an autonomous goal (8 steps)
6. Start the HTTP API server on port 8080
7. Serve the dashboard at `/`

### CLI mode

```bash
npx tsx packages/deployment/src/cli.ts status
npx tsx packages/deployment/src/cli.ts process "hello COS"
npx tsx packages/deployment/src/cli.ts memory --stats
```

## What to do after launch

### 1. Open the Dashboard
```
http://localhost:8080/
```
Shows real-time system health, memory stats, knowledge graph, self-improvement, and an API playground.

### 2. Try the Chat
```
http://localhost:8080/chat
```
Interactive chat that uses the full cognitive pipeline: memory search → knowledge graph query → reasoning → LLM generation → memory storage → self-improvement.

### 3. Test the API

```bash
# Health check
curl http://localhost:8080/health

# Process input
curl -X POST http://localhost:8080/process \
  -H "Content-Type: application/json" \
  -d '{"input": "hello COS"}'

# Run reasoning
curl -X POST http://localhost:8080/process \
  -H "Content-Type: application/json" \
  -d '{"input": {"problem": "analyze", "steps": 3}, "reasoning": "chain_of_thought"}'

# Create an autonomous goal
curl -X POST http://localhost:8080/goals \
  -H "Content-Type: application/json" \
  -d '{"description": "Analyze the system architecture"}'

# Run self-improvement
curl http://localhost:8080/self-improve

# Generate auth token
curl -X POST http://localhost:8080/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "admin", "role": "admin"}'

# Query knowledge graph
curl http://localhost:8080/knowledge/COS

# Chat with the COS
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the Cognitive Operating System?"}'
```

### 4. Run the training demo

```bash
npx tsx scripts/training-demo.ts
```

Demonstrates the self-improvement feedback loop over 30 iterations.

## Architecture overview

```
cos/
├── packages/
│   ├── core/             Types, errors, BaseCell
│   ├── runtime/          EventBus, Scheduler, State, CellHost
│   ├── memory/           12-layer memory system
│   ├── knowledge/        Property graph, embeddings, ontology
│   ├── cognition/        5 reasoning engines, planning, evaluation, learning
│   ├── execution/        Real tools (FS, HTTP, Search), code sandbox
│   ├── orchestration/    Agents, workflows, policies, autonomous loop
│   ├── observability/    Telemetry (events + metrics)
│   ├── api/              HTTP server, auth, dashboard, chat
│   ├── infrastructure/   Config, persistence
│   └── deployment/       Bootstrap, CLI, launch
├── docs/                 Architecture, memory, graphs, API, security docs
├── scripts/              Setup, training demo, report generation
├── Dockerfile            Production container build
└── README.md             Full documentation
```

## Troubleshooting Guide

### 1. Dependency Failures

#### `tsx: command not found`

```bash
# El paquete tsx no está instalado. Instálalo global o localmente:
npm install --no-save tsx

# Verificar instalación:
npx tsx --version
# Debería mostrar: tsx v4.x.x
```

**Causa raíz:** `tsx` es el transpilador TypeScript que ejecuta los archivos `.ts` directamente. No está incluido en las dependencias base del proyecto porque `tsx` puede instalarse de múltiples formas. El script `setup-and-launch.sh` lo instala automáticamente.

#### `sharp: module not found`

```bash
# sharp se usa para convertir SVG a PNG en los reportes de entrenamiento.
# No es necesario para el funcionamiento del COS, solo para generar gráficos.
npm install --no-save sharp
```

**Causa raíz:** `sharp` requiere compilación nativa. Si falla la instalación, el COS funciona igual — solo falla la generación de reportes visuales. Alternativa: usar `npx sharp-cli` en lugar de la librería.

#### `Error: Cannot find module '@cos/core'`

```bash
# Los paquetes internos no se resolvieron correctamente.
# Asegúrate de estar en el directorio raíz del proyecto:
cd /path/to/cos

# Si el error persiste, reinstala:
npm install
```

**Causa raíz:** Los 11 paquetes `@cos/*` se referencian entre sí mediante `workspaces` en el `package.json` raíz. Si npm no configura los workspaces correctamente, las importaciones fallan.

#### TypeScript compilation errors during `npm start`

```
error TS2304: Cannot find name 'EntityId'
error TS5112: tsconfig.json is present but will not be loaded
```

**Solución:** `tsx` ejecuta TypeScript directamente sin compilación. Estos errores son del linter interno de `tsx` cuando detecta un `tsconfig.json` en el directorio. **No afectan la ejecución.** El código se ejecuta correctamente aunque aparezcan estos warnings.

**Causa raíz:** `tsx` intenta cargar `tsconfig.json` para mejorar el resaltado de errores, pero como los archivos se pasan por línea de comandos, no puede aplicarlo. Es un falso positivo.

---

### 2. Errores de Conexión con Proveedores de IA

#### `OpenAI API error 401: Incorrect API key`

```
Error: OpenAI API error 401: {
  "error": {
    "message": "Incorrect API key provided",
    "type": "invalid_request_error"
  }
}
```

**Causa:** La API key de OpenAI es inválida o no tiene créditos.

**Soluciones:**
```bash
# 1. Verificar que la variable está configurada:
echo $OPENAI_API_KEY
# Debería empezar con "sk-..."

# 2. Configurar la key correcta:
export OPENAI_API_KEY="sk-proj-..."

# 3. Verificar que la key tiene créditos en:
# https://platform.openai.com/account/usage
```

**Nota:** El COS funciona **sin API key**. Cuando no hay key configurada, usa `SimulatedProvider` que genera respuestas basadas en patrones localmente. Para activar IA real, configura `OPENAI_API_KEY`.

#### `OpenAI API error 429: Rate limit exceeded`

```
Error: OpenAI API error 429: {
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error"
  }
}
```

**Causa:** Se superó el límite de peticiones por minuto de OpenAI.

**Soluciones:**
```bash
# 1. Esperar 60 segundos y reintentar

# 2. Usar un modelo más rápido (gpt-4o-mini tiene mejores límites):
export OPENAI_MODEL="gpt-4o-mini"

# 3. Reducir la frecuencia de peticiones del COS:
export COS_EVAL_FREQ=10  # Evaluar cada 10 salidas en vez de 3
```

#### `OpenAI API request timeout`

```
Error: OpenAI API request timeout
```

**Causa:** La petición a OpenAI tardó más de 60 segundos.

**Soluciones:**
```bash
# 1. Verificar conectividad a internet:
curl -I https://api.openai.com

# 2. Si estás detrás de un proxy, configurarlo:
export HTTPS_PROXY="http://proxy:8080"

# 3. Usar un endpoint alternativo (Azure OpenAI, Ollama local):
export OPENAI_BASE_URL="https://my-instance.openai.azure.com"
```

#### `OpenAI provider not available: no API key configured`

```
Error: OpenAI provider not available: no API key configured.
Set OPENAI_API_KEY or use SimulatedProvider.
```

**Causa:** Se intentó usar el proveedor OpenAI sin configurar la API key. Esto no es un error del COS — es un error de configuración.

**Solución:** El COS selecciona automáticamente el proveedor correcto. Si no hay API key, usa SimulatedProvider. Este error solo aparece si se fuerza manualmente el uso de OpenAI sin key. Usa `server.llm.get()` en vez de `server.llm.get('openai')` para auto-selección.

#### El COS no se conecta a la API de OpenAI aunque la key está configurada

```bash
# Diagnóstico:
npx tsx -e "
const {LLMFactory} = require('./packages/cognition/src/index.ts');
const factory = new LLMFactory();
const oai = factory.get('openai');
console.log('Provider:', oai.name);
console.log('Available:', oai.isAvailable());
console.log('Key configured:', process.env.OPENAI_API_KEY ? 'YES (' + process.env.OPENAI_API_KEY.substring(0, 10) + '...)' : 'NO');
"

# Si isAvailable() es false, la key no se está cargando:
# 1. Verificar que la variable está exportada:
export OPENAI_API_KEY="sk-..."
# 2. O cargarla desde .env:
set -a; source .env; set +a
```

---

### 3. Problemas de Persistencia de Datos

#### Los datos no sobreviven al reinicio

**Causa:** La persistencia está desactivada o el directorio de datos no es accesible.

**Diagnóstico:**
```bash
# 1. Verificar que el directorio de persistencia existe:
ls -la .cos-data/

# 2. Si no existe, crearlo:
mkdir -p .cos-data

# 3. Verificar permisos de escritura:
touch .cos-data/test-write && rm .cos-data/test-write && echo "Writable"

# 4. Verificar la configuración:
echo $COS_DATA_DIR  # Debería mostrar: ./.cos-data
```

**Soluciones:**
```bash
# Configurar un directorio absoluto para evitar ambigüedades:
export COS_DATA_DIR="/home/user/cos-data"
mkdir -p "$COS_DATA_DIR"

# Verificar que el PersistenceManager encuentra los archivos:
ls -la "$COS_DATA_DIR"/*.json
```

#### `FileBackedData: saved 0 keys` — La persistencia no guarda nada

**Causa:** `FileBackedData` requiere que se llame explícitamente a `save()`. El `FileBackedMemory` tiene auto-save con debounce de 5 segundos.

**Diagnóstico:**
```bash
npx tsx -e "
const infra = require('./packages/infrastructure/src/index.ts');
const pm = new infra.PersistenceManager('/tmp/cos-test');
pm.init().then(async () => {
  const store = new infra.FileBackedData('/tmp/cos-test', 'test');
  store.set('key', 'value');
  await store.save();
  const store2 = new infra.FileBackedData('/tmp/cos-test', 'test');
  await store2.load();
  console.log('Load test:', store2.get('key'));  // Debería mostrar: 'value'
});
"
```

#### El archivo JSON de persistencia está corrupto

```
Error: JSON.parse error in FileBackedData.load()
```

**Causa:** El archivo JSON se escribió parcialmente (corte durante escritura) o fue modificado externamente.

**Solución:**
```bash
# 1. Hacer backup del archivo dañado:
cp .cos-data/*.json /tmp/cos-backup/

# 2. Eliminar el archivo dañado (se recreará vacío):
rm .cos-data/memory.json

# 3. Reintentar. Los datos se perderán pero el sistema arrancará.
```

---

### 4. Diagnóstico de Estado Degradado

#### El sistema siempre muestra `status: degraded` en `/health`

**Causa:** El estado `degraded` es normal en el COS. Significa que el sistema está funcionando pero no se ha llamado a `cellHost.start()`. El `launch.ts` arranca el servidor HTTP pero no inicia el scheduler de polling automático para evitar procesos en background que nunca terminan.

**Diagnóstico completo:**
```bash
# 1. Obtener estado detallado:
curl -s http://localhost:8080/health | npx tsx -e "
const d=require('fs').readFileSync('/dev/stdin','utf-8');
const h=JSON.parse(d);
console.log('System status:', h.system?.status);
console.log('Cells:', h.system?.metrics?.cells);
console.log('Tools:', h.system?.metrics?.tools);
console.log('Memory:', h.system?.metrics?.memory);
console.log('Agents:', h.system?.metrics?.agents);
console.log('');
console.log('Cell health:');
Object.entries(h).filter(([k]) => k !== 'system').forEach(([k,v]) => {
  console.log('  ' + k + ': ' + (v.status || 'unknown') + (v.message ? ' (' + v.message + ')' : ''));
});
"

# 2. Obtener estadísticas completas:
curl -s http://localhost:8080/stats | npx tsx -e "
const d=require('fs').readFileSync('/dev/stdin','utf-8');
const s=JSON.parse(d);
console.log('Runtime:', JSON.stringify(s.runtime));
console.log('Memory:', JSON.stringify(s.memory));
console.log('Knowledge:', JSON.stringify(s.knowledge));
console.log('Reasoning engines:', s.reasoning);
console.log('Tools:', s.tools);
console.log('Agents:', s.agents);
"
```

#### Tabla de estados de salud

| Estado | Significado | Acción requerida |
|--------|-------------|------------------|
| `healthy` | Sistema funcionando óptimamente | Ninguna |
| `degraded` | Sistema funcionando, sin scheduler automático | **Normal en COS.** No requiere acción. |
| `unhealthy` | Subsistema crítico falló | Revisar logs, reiniciar el subsistema |
| `unknown` | No se ha verificado la salud | Llamar a `cell.getHealth()` para iniciar chequeo |

#### Diagnóstico paso a paso de estado degradado

```bash
# Paso 1: Verificar que el servidor responde
curl -o /dev/null -s -w "%{http_code}" http://localhost:8080/health
# Debería devolver: 200

# Paso 2: Verificar células registradas
curl -s http://localhost:8080/cells | npx tsx -e "
const d=require('fs').readFileSync('/dev/stdin','utf-8');
JSON.parse(d).forEach(c => console.log(c.name + ': ' + c.type + ' (' + (c.health?.status || 'unknown') + ')'));
"

# Paso 3: Verificar memoria
curl -s http://localhost:8080/memory | npx tsx -e "
const d=require('fs').readFileSync('/dev/stdin','utf-8');
const m=JSON.parse(d);
console.log('Total entries:', m.totalEntries);
Object.entries(m.byLayer).filter(([_,c]) => c > 0).forEach(([l,c]) => console.log('  ' + l + ': ' + c));
"

# Paso 4: Verificar motor de razonamiento
npx tsx -e "
const {ReasoningEngineRegistry} = require('./packages/cognition/src/index.ts');
const r = new ReasoningEngineRegistry();
r.getAll().forEach(e => console.log('Engine: ' + e.type + ' | Capabilities: ' + e.getCapabilities().length));
"

# Paso 5: Verificar herramientas
npx tsx -e "
const {ToolRegistry} = require('./packages/execution/src/index.ts');
const t = new ToolRegistry();
t.getDefinitions().forEach(d => console.log('Tool: ' + d.name + ' v' + d.version.major + '.' + d.version.minor));
"

# Paso 6: Verificar eventos
npx tsx -e "
const {EventBus} = require('./packages/runtime/src/index.ts');
const bus = new EventBus();
bus.subscribe('*', async (e) => console.log('Event:', e.type));
bus.publish({type:'health-check', source:'test', payload:{}, severity:'info', metadata:{}});
console.log('EventBus: OK');
"
```

#### `CellHealth: degraded` — Célula específica funciona mal

```bash
# Obtener inspección detallada de una célula:
curl -s http://localhost:8080/cells | npx tsx -e "
const d=require('fs').readFileSync('/dev/stdin','utf-8');
const cells = JSON.parse(d);
cells.forEach(c => {
  console.log('=== ' + c.name + ' ===');
  console.log('  ID: ' + c.id);
  console.log('  Type: ' + c.type);
  console.log('  Health: ' + (c.health?.status || 'unknown'));
  console.log('  Message: ' + (c.health?.message || 'none'));
});
"
```

#### `Scheduler stats: completed=0` — Las tareas no se ejecutan

**Causa:** El scheduler está en modo manual (no se llamó a `scheduler.start()`). El `launch.ts` no inicia el scheduler automático para evitar procesos en background.

**Solución:** Las tareas se ejecutan síncronamente a través de `cell.process()` directamente, no a través del scheduler. El scheduler solo se usa para procesamiento asíncrono con cola. Si necesitas el scheduler:

```typescript
const server = new COSServer();
await server.cellHost.scheduler.start(); // Inicia el polling loop
```

---

### 5. Errores de Red y Conexión

#### `ECONNREFUSED` al usar el CLI

```
Error: connect ECONNREFUSED ::1:8080
```

**Causa:** El servidor COS no está corriendo cuando intentas usar el CLI.

**Solución:**
```bash
# 1. Iniciar el servidor primero:
npm start

# 2. En otra terminal, ejecutar el comando CLI:
npx tsx packages/deployment/src/cli.ts status
```

#### `FetchError: request to http://localhost:8080/ failed`

**Causa:** El dashboard intenta conectarse al API pero el servidor no está corriendo.

**Solución:** El dashboard se auto-actualiza cada 5 segundos. Si el servidor se inicia después, el dashboard se conecta automáticamente. Si el problema persiste:
```bash
# Verificar que el servidor está escuchando:
curl http://localhost:8080/health

# Verificar el puerto correcto:
echo $COS_PORT  # Por defecto: 8080
```

---

### 6. Errores de Ejecución de TypeScript

#### `SyntaxError: Unexpected identifier 'as'`

**Causa:** Se está ejecutando un archivo `.ts` con `node` en vez de `tsx`.

**Solución:** Usar `npx tsx` en vez de `node` para archivos TypeScript:
```bash
# ❌ Incorrecto:
node packages/deployment/src/launch.ts

# ✅ Correcto:
npx tsx packages/deployment/src/launch.ts
```

#### `COSSERVER is not defined` / `COSSERVER is not a constructor`

**Causa:** El nombre exportado es `COSSERVER` (camelCase, COS + Server) no `COSSERVER` (all caps). Esto es un detalle de la implementación interna.

**Solución:**
```typescript
// ✅ Correcto:
const api = require('./packages/api/src/index.ts');
const server = new api.COSServer({ port: 0 });

// ❌ Incorrecto:
const {COSSERVER} = require('./packages/api/src/index.ts');
```

---

### 7. Problemas con el Dashboard

#### Dashboard muestra datos vacíos o congelados

**Causa:** El dashboard se auto-actualiza cada 5 segundos. Si los datos no cambian, puede que el servidor no esté procesando nuevas peticiones.

**Diagnóstico:**
```bash
# 1. Verificar que el endpoint del dashboard responde:
curl -o /dev/null -s -w "%{http_code}" http://localhost:8080/
# Debería devolver: 200

# 2. Verificar que el contenido es HTML (no JSON):
curl -s http://localhost:8080/ | head -1
# Debería empezar con: <!DOCTYPE html>

# 3. Recargar manualmente el dashboard: Ctrl+R en el navegador
```

#### Dashboard muestra errores en la consola del navegador

```
Failed to load resource: the server responded with a status of 500
```

**Causa:** Uno de los endpoints del API está fallando.

**Diagnóstico:** Abrir la consola del navegador (F12) y ver qué endpoint específico falla. Luego probar ese endpoint directamente:
```bash
curl http://localhost:8080/health
curl http://localhost:8080/memory
curl http://localhost:8080/self-improve
```

---

### 8. Problemas de Rendimiento

#### El sistema responde lento (> 1s por petición)

**Causa:** El `SimulatedProvider` genera respuestas basadas en patrones que son instantáneas. Si hay latencia, puede deberse a:
1. OpenAI API lenta (si está configurada)
2. Operaciones de filesystem pesadas en persistencia
3. Muchas entradas en memoria (miles)

**Diagnóstico:**
```bash
# Medir tiempo de respuesta:
time curl -X POST http://localhost:8080/process \
  -H "Content-Type: application/json" \
  -d '{"input": "test"}'

# Verificar tamaño de la memoria:
curl -s http://localhost:8080/memory | npx tsx -e "
const d=require('fs').readFileSync('/dev/stdin','utf-8');
console.log('Entries:', JSON.parse(d).totalEntries);
"
```

**Soluciones:**
```bash
# Reducir frecuencia de auto-evaluación:
export COS_EVAL_FREQ=10

# Desactivar auto-mejora si no es necesaria:
export COS_SELF_IMPROVEMENT=false

# Limpiar memoria si hay demasiadas entradas:
curl -X POST http://localhost:8080/process \
  -H "Content-Type: application/json" \
  -d '{"target": "memory-clear"}'
```

---

### 9. Checklist de Diagnóstico Rápido

Cuando el sistema no arranca o funciona mal, ejecuta esto:

```bash
#!/bin/bash
echo "=== COS DIAGNOSTIC CHECKLIST ==="

echo -n "Node.js version:      "; node --version
echo -n "npm version:          "; npm --version
echo -n "tsx available:        "; npx tsx --version 2>/dev/null || echo "NO"
echo -n "COS directory:        "; ls package.json >/dev/null 2>&1 && echo "OK" || echo "NOT FOUND"
echo -n "Core modules:         "; npx tsx -e "require('./packages/core/src/index.ts'); console.log('OK')" 2>/dev/null || echo "FAIL"
echo -n "All packages:         "; npx tsx -e "const m=['./packages/runtime','./packages/memory','./packages/knowledge','./packages/cognition','./packages/execution','./packages/orchestration']; m.forEach(p=>{try{require(p+'/src/index.ts')}catch(e){console.log('FAIL:',p);process.exit(1)}}); console.log('OK')" 2>/dev/null || echo "FAIL"
echo -n "Server running:       "; curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null || echo "NO"
echo -n "OpenAI key:           "; [ -n "$OPENAI_API_KEY" ] && echo "CONFIGURED" || echo "NOT SET (using simulated)"
echo -n "Data dir writable:    "; touch .cos-data/.write-test 2>/dev/null && rm .cos-data/.write-test && echo "YES" || echo "NO"
echo -n "Memory entries:       "; curl -s http://localhost:8080/memory 2>/dev/null | npx tsx -e "try{const d=require('fs').readFileSync('/dev/stdin','utf-8');console.log(JSON.parse(d).totalEntries)}catch(e){console.log('N/A')}" 2>/dev/null || echo "N/A"
echo -n "Cells registered:     "; curl -s http://localhost:8080/cells 2>/dev/null | npx tsx -e "try{const d=require('fs').readFileSync('/dev/stdin','utf-8');console.log(JSON.parse(d).length)}catch(e){console.log('N/A')}" 2>/dev/null || echo "N/A"
echo "=== END ==="
```

---

### 10. Referencia Rápida de Errores

| Error | Síntoma | Causa más probable | Solución rápida |
|-------|---------|-------------------|-----------------|
| `tsx: command not found` | `npm start` falla | tsx no instalado | `npm install --no-save tsx` |
| `Cannot find module '@cos/core'` | Cualquier comando falla | Workspaces no configurados | `npm install` desde la raíz |
| `COSSERVER is not defined` | Servidor no arranca | Nombre incorrecto | Usar `api.COSServer` |
| `status: degraded` | /health muestra degraded | **Normal** | No requiere acción |
| `OpenAI API error 401` | Chat/respuestas fallan | API key inválida | Verificar `OPENAI_API_KEY` |
| `ECONNREFUSED` | CLI no conecta | Servidor no iniciado | `npm start` primero |
| `JSON parse error` | Persistencia falla | Archivo corrupto | `rm .cos-data/*.json` |
| Puerto ocupado | Servidor no inicia | Otro proceso en el puerto | `COS_PORT=9090 npm start` |
| Dashboard no carga | Página en blanco | Servidor no iniciado | `npm start` |
| Chat devuelve HTML | `POST /chat` falla | Content-Type incorrecto | Usar `'Content-Type: application/json'` |
| Respuestas lentas | >1s por petición | OpenAI rate limit o mucha memoria | Reducir `COS_EVAL_FREQ` o desactivar auto-mejora |

## What's included

- 11 packages, 35 TypeScript source files
- 5 reasoning engines (CoT, ToT, Reflection, GoT, Debate)
- 12 memory layers with TTL, consolidation, forgetting
- Real tools (filesystem, HTTP, search, sandbox)
- Self-improvement feedback loop
- Autonomous goal execution
- REST API (15 endpoints)
- Real-time dashboard
- Chat interface with full cognitive pipeline
- CLI with 7 commands
- Dockerfile for production
- Persistence (filesystem-backed)