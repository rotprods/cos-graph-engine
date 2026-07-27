"use strict";
/**
 * COS Graph Engine - Internacionalizacion (Fase 11)
 *
 * Proporciona:
 * 1. i18n labels en ES/EN/PT/FR/DE para renderers
 * 2. Funciones de traduccion para grafos
 * 3. CLI i18n support
 *
 * Zero dependencias externas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCALE_NAMES = exports.LOCALES = void 0;
exports.t = t;
exports.setLocale = setLocale;
exports.getLocale = getLocale;
exports.getLabels = getLabels;
exports.translateGraph = translateGraph;
exports.getLocaleName = getLocaleName;
exports.listLocales = listLocales;
exports.LOCALES = ['en', 'es', 'pt', 'fr', 'de'];
exports.LOCALE_NAMES = {
    en: 'English', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch',
};
const EN = {
    start: 'Start', end: 'End', process: 'Process', decision: 'Decision',
    input: 'Input', output: 'Output', error: 'Error',
    edge: 'Edge', node: 'Node', graph: 'Graph', pipeline: 'Pipeline',
    level: 'Level', name: 'Name', status: 'Status', metrics: 'Metrics',
    validation: 'Validation', source: 'Source', target: 'Target',
    label: 'Label', weight: 'Weight', condition: 'Condition',
    loop: 'Loop', branch: 'Branch', merge: 'Merge',
    parallel: 'Parallel', sequential: 'Sequential',
};
const ES = {
    start: 'Inicio', end: 'Fin', process: 'Proceso', decision: 'Decisión',
    input: 'Entrada', output: 'Salida', error: 'Error',
    edge: 'Arista', node: 'Nodo', graph: 'Grafo', pipeline: 'Pipeline',
    level: 'Nivel', name: 'Nombre', status: 'Estado', metrics: 'Métricas',
    validation: 'Validación', source: 'Origen', target: 'Destino',
    label: 'Etiqueta', weight: 'Peso', condition: 'Condición',
    loop: 'Bucle', branch: 'Rama', merge: 'Fusión',
    parallel: 'Paralelo', sequential: 'Secuencial',
};
const PT = {
    start: 'Início', end: 'Fim', process: 'Processo', decision: 'Decisão',
    input: 'Entrada', output: 'Saída', error: 'Erro',
    edge: 'Aresta', node: 'Nó', graph: 'Grafo', pipeline: 'Pipeline',
    level: 'Nível', name: 'Nome', status: 'Estado', metrics: 'Métricas',
    validation: 'Validação', source: 'Origem', target: 'Destino',
    label: 'Rótulo', weight: 'Peso', condition: 'Condição',
    loop: 'Ciclo', branch: 'Ramo', merge: 'Fusão',
    parallel: 'Paralelo', sequential: 'Sequencial',
};
const FR = {
    start: 'Début', end: 'Fin', process: 'Processus', decision: 'Décision',
    input: 'Entrée', output: 'Sortie', error: 'Erreur',
    edge: 'Arête', node: 'Nœud', graph: 'Graphe', pipeline: 'Pipeline',
    level: 'Niveau', name: 'Nom', status: 'État', metrics: 'Métriques',
    validation: 'Validation', source: 'Source', target: 'Cible',
    label: 'Étiquette', weight: 'Poids', condition: 'Condition',
    loop: 'Boucle', branch: 'Branche', merge: 'Fusion',
    parallel: 'Parallèle', sequential: 'Séquentiel',
};
const DE = {
    start: 'Start', end: 'Ende', process: 'Prozess', decision: 'Entscheidung',
    input: 'Eingabe', output: 'Ausgabe', error: 'Fehler',
    edge: 'Kante', node: 'Knoten', graph: 'Graph', pipeline: 'Pipeline',
    level: 'Ebene', name: 'Name', status: 'Status', metrics: 'Metriken',
    validation: 'Validierung', source: 'Quelle', target: 'Ziel',
    label: 'Bezeichnung', weight: 'Gewicht', condition: 'Bedingung',
    loop: 'Schleife', branch: 'Zweig', merge: 'Vereinigung',
    parallel: 'Parallel', sequential: 'Sequentiell',
};
const LABELS = { en: EN, es: ES, pt: PT, fr: FR, de: DE };
let currentLocale = 'en';
/** Get labels for the current locale */
function t(key) {
    const labels = LABELS[currentLocale];
    return labels[key] || EN[key] || key;
}
/** Set the current locale */
function setLocale(locale) {
    if (exports.LOCALES.includes(locale))
        currentLocale = locale;
}
/** Get the current locale */
function getLocale() {
    return currentLocale;
}
/** Get all labels for a locale */
function getLabels(locale) {
    return LABELS[locale || currentLocale] || EN;
}
/** Translate a graph's node labels to the current locale */
function translateGraph(graph, locale) {
    const loc = locale || currentLocale;
    const labels = LABELS[loc] || EN;
    const result = JSON.parse(JSON.stringify(graph));
    if (result.nodes) {
        for (const n of result.nodes) {
            if (n.label && labels[n.label.toLowerCase()]) {
                n.label = labels[n.label.toLowerCase()];
            }
        }
    }
    if (result.edges) {
        for (const e of result.edges) {
            if (e.label && labels[e.label.toLowerCase()]) {
                e.label = labels[e.label.toLowerCase()];
            }
        }
    }
    return result;
}
/** Get locale display name */
function getLocaleName(locale) {
    return exports.LOCALE_NAMES[locale || currentLocale] || 'English';
}
/** List all available locales */
function listLocales() {
    return exports.LOCALES.map(code => ({ code, name: exports.LOCALE_NAMES[code] }));
}
//# sourceMappingURL=i18n.js.map