/**
 * Tests de Internacionalizacion (Fase 11)
 * Prueba: i18n labels, setLocale, translateGraph, listLocales
 */

import { t, setLocale, getLocale, getLabels, translateGraph, listLocales, LOCALES, LOCALE_NAMES } from '../packages/graph/src/i18n';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function section(name: string) { console.log(`\n=== ${name} ===`); }

// =============================================
// T-11.1: Render multilingue
// =============================================
section('Locale Management');

// Default locale
assert(getLocale() === 'en', 'Default locale is English');
assert(t('start') === 'Start', 'Default t() returns English');

// All locales exist
assert(LOCALES.length === 5, '5 locales defined');
assert(LOCALES.includes('en'), 'English included');
assert(LOCALES.includes('es'), 'Spanish included');
assert(LOCALES.includes('pt'), 'Portuguese included');
assert(LOCALES.includes('fr'), 'French included');
assert(LOCALES.includes('de'), 'German included');

// Locale names
assert(LOCALE_NAMES.en === 'English', 'EN name correct');
assert(LOCALE_NAMES.es === 'Español', 'ES name correct');
assert(LOCALE_NAMES.pt === 'Português', 'PT name correct');
assert(LOCALE_NAMES.fr === 'Français', 'FR name correct');
assert(LOCALE_NAMES.de === 'Deutsch', 'DE name correct');

section('Spanish Translations');

setLocale('es');
assert(getLocale() === 'es', 'Locale changed to Spanish');
assert(t('start') === 'Inicio', 'ES: start = Inicio');
assert(t('end') === 'Fin', 'ES: end = Fin');
assert(t('process') === 'Proceso', 'ES: process = Proceso');
assert(t('decision') === 'Decisión', 'ES: decision = Decisión');
assert(t('input') === 'Entrada', 'ES: input = Entrada');
assert(t('output') === 'Salida', 'ES: output = Salida');
assert(t('error') === 'Error', 'ES: error = Error');
assert(t('node') === 'Nodo', 'ES: node = Nodo');
assert(t('edge') === 'Arista', 'ES: edge = Arista');
assert(t('graph') === 'Grafo', 'ES: graph = Grafo');
assert(t('loop') === 'Bucle', 'ES: loop = Bucle');
assert(t('branch') === 'Rama', 'ES: branch = Rama');

section('Portuguese Translations');

setLocale('pt');
assert(t('start') === 'Início', 'PT: start = Início');
assert(t('end') === 'Fim', 'PT: end = Fim');
assert(t('process') === 'Processo', 'PT: process = Processo');
assert(t('decision') === 'Decisão', 'PT: decision = Decisão');
assert(t('node') === 'Nó', 'PT: node = Nó');

section('French Translations');

setLocale('fr');
assert(t('start') === 'Début', 'FR: start = Début');
assert(t('end') === 'Fin', 'FR: end = Fin');
assert(t('process') === 'Processus', 'FR: process = Processus');
assert(t('decision') === 'Décision', 'FR: decision = Décision');
assert(t('node') === 'Nœud', 'FR: node = Nœud');

section('German Translations');

setLocale('de');
assert(t('start') === 'Start', 'DE: start = Start');
assert(t('end') === 'Ende', 'DE: end = Ende');
assert(t('process') === 'Prozess', 'DE: process = Prozess');
assert(t('decision') === 'Entscheidung', 'DE: decision = Entscheidung');
assert(t('node') === 'Knoten', 'DE: node = Knoten');
assert(t('loop') === 'Schleife', 'DE: loop = Schleife');

section('Fallback and Unknown Keys');

assert(t('nonexistent_key_xyz') === 'nonexistent_key_xyz', 'Unknown key returns key itself');

section('getLabels');

setLocale('en');
const enLabels = getLabels();
assert(enLabels.start === 'Start', 'getLabels EN start');
assert(enLabels.end === 'End', 'getLabels EN end');

const esLabels = getLabels('es');
assert(esLabels.start === 'Inicio', 'getLabels ES start');
assert(esLabels.end === 'Fin', 'getLabels ES end');

const frLabels = getLabels('fr');
assert(frLabels.start === 'Début', 'getLabels FR start');

section('translateGraph');

setLocale('en');
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

const esGraph = translateGraph(graph, 'es');
assert(esGraph.nodes[0].label === 'Inicio', 'translateGraph: Start → Inicio');
assert(esGraph.nodes[1].label === 'Proceso', 'translateGraph: Process → Proceso');
assert(esGraph.nodes[2].label === 'Decisión', 'translateGraph: Decision → Decisión');
assert(esGraph.nodes[3].label === 'Fin', 'translateGraph: End → Fin');
// Non-translatable labels stay unchanged
assert(esGraph.edges[0].label === 'enter', 'translateGraph: non-label stays unchanged');

const deGraph = translateGraph(graph, 'de');
assert(deGraph.nodes[0].label === 'Start', 'translateGraph: Start → Start (DE)');
assert(deGraph.nodes[1].label === 'Prozess', 'translateGraph: Process → Prozess');
assert(deGraph.nodes[3].label === 'Ende', 'translateGraph: End → Ende');

section('listLocales');

const locales = listLocales();
assert(locales.length === 5, 'listLocales returns 5 locales');
assert(locales[0].code === 'en', 'First locale is en');
assert(locales[0].name === 'English', 'First locale name English');
assert(locales[1].code === 'es', 'Second locale is es');
assert(locales[1].name === 'Español', 'Second locale name Español');

section('Summary');
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);