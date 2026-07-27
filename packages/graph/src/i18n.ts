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

export type Locale = 'en' | 'es' | 'pt' | 'fr' | 'de';

export const LOCALES: Locale[] = ['en', 'es', 'pt', 'fr', 'de'];
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch',
};

// ============================================================
// Graph node/edge labels
// ============================================================

export interface GraphLabels {
  start: string;
  end: string;
  process: string;
  decision: string;
  input: string;
  output: string;
  error: string;
  edge: string;
  node: string;
  graph: string;
  pipeline: string;
  level: string;
  name: string;
  status: string;
  metrics: string;
  validation: string;
  source: string;
  target: string;
  label: string;
  weight: string;
  condition: string;
  loop: string;
  branch: string;
  merge: string;
  parallel: string;
  sequential: string;
  [key: string]: string;
}

const EN: GraphLabels = {
  start: 'Start', end: 'End', process: 'Process', decision: 'Decision',
  input: 'Input', output: 'Output', error: 'Error',
  edge: 'Edge', node: 'Node', graph: 'Graph', pipeline: 'Pipeline',
  level: 'Level', name: 'Name', status: 'Status', metrics: 'Metrics',
  validation: 'Validation', source: 'Source', target: 'Target',
  label: 'Label', weight: 'Weight', condition: 'Condition',
  loop: 'Loop', branch: 'Branch', merge: 'Merge',
  parallel: 'Parallel', sequential: 'Sequential',
};

const ES: GraphLabels = {
  start: 'Inicio', end: 'Fin', process: 'Proceso', decision: 'Decisión',
  input: 'Entrada', output: 'Salida', error: 'Error',
  edge: 'Arista', node: 'Nodo', graph: 'Grafo', pipeline: 'Pipeline',
  level: 'Nivel', name: 'Nombre', status: 'Estado', metrics: 'Métricas',
  validation: 'Validación', source: 'Origen', target: 'Destino',
  label: 'Etiqueta', weight: 'Peso', condition: 'Condición',
  loop: 'Bucle', branch: 'Rama', merge: 'Fusión',
  parallel: 'Paralelo', sequential: 'Secuencial',
};

const PT: GraphLabels = {
  start: 'Início', end: 'Fim', process: 'Processo', decision: 'Decisão',
  input: 'Entrada', output: 'Saída', error: 'Erro',
  edge: 'Aresta', node: 'Nó', graph: 'Grafo', pipeline: 'Pipeline',
  level: 'Nível', name: 'Nome', status: 'Estado', metrics: 'Métricas',
  validation: 'Validação', source: 'Origem', target: 'Destino',
  label: 'Rótulo', weight: 'Peso', condition: 'Condição',
  loop: 'Ciclo', branch: 'Ramo', merge: 'Fusão',
  parallel: 'Paralelo', sequential: 'Sequencial',
};

const FR: GraphLabels = {
  start: 'Début', end: 'Fin', process: 'Processus', decision: 'Décision',
  input: 'Entrée', output: 'Sortie', error: 'Erreur',
  edge: 'Arête', node: 'Nœud', graph: 'Graphe', pipeline: 'Pipeline',
  level: 'Niveau', name: 'Nom', status: 'État', metrics: 'Métriques',
  validation: 'Validation', source: 'Source', target: 'Cible',
  label: 'Étiquette', weight: 'Poids', condition: 'Condition',
  loop: 'Boucle', branch: 'Branche', merge: 'Fusion',
  parallel: 'Parallèle', sequential: 'Séquentiel',
};

const DE: GraphLabels = {
  start: 'Start', end: 'Ende', process: 'Prozess', decision: 'Entscheidung',
  input: 'Eingabe', output: 'Ausgabe', error: 'Fehler',
  edge: 'Kante', node: 'Knoten', graph: 'Graph', pipeline: 'Pipeline',
  level: 'Ebene', name: 'Name', status: 'Status', metrics: 'Metriken',
  validation: 'Validierung', source: 'Quelle', target: 'Ziel',
  label: 'Bezeichnung', weight: 'Gewicht', condition: 'Bedingung',
  loop: 'Schleife', branch: 'Zweig', merge: 'Vereinigung',
  parallel: 'Parallel', sequential: 'Sequentiell',
};

const LABELS: Record<Locale, GraphLabels> = { en: EN, es: ES, pt: PT, fr: FR, de: DE };

let currentLocale: Locale = 'en';

/** Get labels for the current locale */
export function t(key: string): string {
  const labels = LABELS[currentLocale];
  return labels[key] || EN[key] || key;
}

/** Set the current locale */
export function setLocale(locale: Locale): void {
  if (LOCALES.includes(locale)) currentLocale = locale;
}

/** Get the current locale */
export function getLocale(): Locale {
  return currentLocale;
}

/** Get all labels for a locale */
export function getLabels(locale?: Locale): GraphLabels {
  return LABELS[locale || currentLocale] || EN;
}

/** Translate a graph's node labels to the current locale */
export function translateGraph<T extends { nodes?: { label?: string; id?: string }[]; edges?: { label?: string }[] }>(
  graph: T, locale?: Locale
): T {
  const loc = locale || currentLocale;
  const labels = LABELS[loc] || EN;
  const result = JSON.parse(JSON.stringify(graph)) as T;

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
export function getLocaleName(locale?: Locale): string {
  return LOCALE_NAMES[locale || currentLocale] || 'English';
}

/** List all available locales */
export function listLocales(): { code: Locale; name: string }[] {
  return LOCALES.map(code => ({ code, name: LOCALE_NAMES[code] }));
}