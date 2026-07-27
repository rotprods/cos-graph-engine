"use strict";
/**
 * Tests de Internacionalizacion (Fase 11)
 * Prueba: i18n labels, setLocale, translateGraph, listLocales
 */
Object.defineProperty(exports, "__esModule", { value: true });
const i18n_1 = require("../packages/graph/src/i18n");
let passed = 0;
let failed = 0;
function assert(condition, msg) {
    if (condition) {
        passed++;
    }
    else {
        failed++;
        console.error(`  FAIL: ${msg}`);
    }
}
function section(name) { console.log(`\n=== ${name} ===`); }
// =============================================
// T-11.1: Render multilingue
// =============================================
section('Locale Management');
// Default locale
assert((0, i18n_1.getLocale)() === 'en', 'Default locale is English');
assert((0, i18n_1.t)('start') === 'Start', 'Default t() returns English');
// All locales exist
assert(i18n_1.LOCALES.length === 5, '5 locales defined');
assert(i18n_1.LOCALES.includes('en'), 'English included');
assert(i18n_1.LOCALES.includes('es'), 'Spanish included');
assert(i18n_1.LOCALES.includes('pt'), 'Portuguese included');
assert(i18n_1.LOCALES.includes('fr'), 'French included');
assert(i18n_1.LOCALES.includes('de'), 'German included');
// Locale names
assert(i18n_1.LOCALE_NAMES.en === 'English', 'EN name correct');
assert(i18n_1.LOCALE_NAMES.es === 'Español', 'ES name correct');
assert(i18n_1.LOCALE_NAMES.pt === 'Português', 'PT name correct');
assert(i18n_1.LOCALE_NAMES.fr === 'Français', 'FR name correct');
assert(i18n_1.LOCALE_NAMES.de === 'Deutsch', 'DE name correct');
section('Spanish Translations');
(0, i18n_1.setLocale)('es');
assert((0, i18n_1.getLocale)() === 'es', 'Locale changed to Spanish');
assert((0, i18n_1.t)('start') === 'Inicio', 'ES: start = Inicio');
assert((0, i18n_1.t)('end') === 'Fin', 'ES: end = Fin');
assert((0, i18n_1.t)('process') === 'Proceso', 'ES: process = Proceso');
assert((0, i18n_1.t)('decision') === 'Decisión', 'ES: decision = Decisión');
assert((0, i18n_1.t)('input') === 'Entrada', 'ES: input = Entrada');
assert((0, i18n_1.t)('output') === 'Salida', 'ES: output = Salida');
assert((0, i18n_1.t)('error') === 'Error', 'ES: error = Error');
assert((0, i18n_1.t)('node') === 'Nodo', 'ES: node = Nodo');
assert((0, i18n_1.t)('edge') === 'Arista', 'ES: edge = Arista');
assert((0, i18n_1.t)('graph') === 'Grafo', 'ES: graph = Grafo');
assert((0, i18n_1.t)('loop') === 'Bucle', 'ES: loop = Bucle');
assert((0, i18n_1.t)('branch') === 'Rama', 'ES: branch = Rama');
section('Portuguese Translations');
(0, i18n_1.setLocale)('pt');
assert((0, i18n_1.t)('start') === 'Início', 'PT: start = Início');
assert((0, i18n_1.t)('end') === 'Fim', 'PT: end = Fim');
assert((0, i18n_1.t)('process') === 'Processo', 'PT: process = Processo');
assert((0, i18n_1.t)('decision') === 'Decisão', 'PT: decision = Decisão');
assert((0, i18n_1.t)('node') === 'Nó', 'PT: node = Nó');
section('French Translations');
(0, i18n_1.setLocale)('fr');
assert((0, i18n_1.t)('start') === 'Début', 'FR: start = Début');
assert((0, i18n_1.t)('end') === 'Fin', 'FR: end = Fin');
assert((0, i18n_1.t)('process') === 'Processus', 'FR: process = Processus');
assert((0, i18n_1.t)('decision') === 'Décision', 'FR: decision = Décision');
assert((0, i18n_1.t)('node') === 'Nœud', 'FR: node = Nœud');
section('German Translations');
(0, i18n_1.setLocale)('de');
assert((0, i18n_1.t)('start') === 'Start', 'DE: start = Start');
assert((0, i18n_1.t)('end') === 'Ende', 'DE: end = Ende');
assert((0, i18n_1.t)('process') === 'Prozess', 'DE: process = Prozess');
assert((0, i18n_1.t)('decision') === 'Entscheidung', 'DE: decision = Entscheidung');
assert((0, i18n_1.t)('node') === 'Knoten', 'DE: node = Knoten');
assert((0, i18n_1.t)('loop') === 'Schleife', 'DE: loop = Schleife');
section('Fallback and Unknown Keys');
assert((0, i18n_1.t)('nonexistent_key_xyz') === 'nonexistent_key_xyz', 'Unknown key returns key itself');
section('getLabels');
(0, i18n_1.setLocale)('en');
const enLabels = (0, i18n_1.getLabels)();
assert(enLabels.start === 'Start', 'getLabels EN start');
assert(enLabels.end === 'End', 'getLabels EN end');
const esLabels = (0, i18n_1.getLabels)('es');
assert(esLabels.start === 'Inicio', 'getLabels ES start');
assert(esLabels.end === 'Fin', 'getLabels ES end');
const frLabels = (0, i18n_1.getLabels)('fr');
assert(frLabels.start === 'Début', 'getLabels FR start');
section('translateGraph');
(0, i18n_1.setLocale)('en');
const graph = {
    nodes: [
        { id: 'n1', label: 'Start' },
        { id: 'n2', label: 'Process' },
        { id: 'n3', label: 'Decision' },
        { id: 'n4', label: 'End' },
    ],
    edges: [
        { id: 'e1', source: 'n1', target: 'n2', label: 'enter' },
        { id: 'e2', source: 'n2', target: 'n3', label: 'check' },
    ],
};
const esGraph = (0, i18n_1.translateGraph)(graph, 'es');
assert(esGraph.nodes[0].label === 'Inicio', 'translateGraph: Start → Inicio');
assert(esGraph.nodes[1].label === 'Proceso', 'translateGraph: Process → Proceso');
assert(esGraph.nodes[2].label === 'Decisión', 'translateGraph: Decision → Decisión');
assert(esGraph.nodes[3].label === 'Fin', 'translateGraph: End → Fin');
// Non-translatable labels stay unchanged
assert(esGraph.edges[0].label === 'enter', 'translateGraph: non-label stays unchanged');
const deGraph = (0, i18n_1.translateGraph)(graph, 'de');
assert(deGraph.nodes[0].label === 'Start', 'translateGraph: Start → Start (DE)');
assert(deGraph.nodes[1].label === 'Prozess', 'translateGraph: Process → Prozess');
assert(deGraph.nodes[3].label === 'Ende', 'translateGraph: End → Ende');
section('listLocales');
const locales = (0, i18n_1.listLocales)();
assert(locales.length === 5, 'listLocales returns 5 locales');
assert(locales[0].code === 'en', 'First locale is en');
assert(locales[0].name === 'English', 'First locale name English');
assert(locales[1].code === 'es', 'Second locale is es');
assert(locales[1].name === 'Español', 'Second locale name Español');
section('Summary');
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test-i18n.js.map