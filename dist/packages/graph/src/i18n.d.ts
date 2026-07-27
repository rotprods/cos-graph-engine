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
export declare const LOCALES: Locale[];
export declare const LOCALE_NAMES: Record<Locale, string>;
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
/** Get labels for the current locale */
export declare function t(key: string): string;
/** Set the current locale */
export declare function setLocale(locale: Locale): void;
/** Get the current locale */
export declare function getLocale(): Locale;
/** Get all labels for a locale */
export declare function getLabels(locale?: Locale): GraphLabels;
/** Translate a graph's node labels to the current locale */
export declare function translateGraph<T extends {
    nodes?: {
        label?: string;
        id?: string;
    }[];
    edges?: {
        label?: string;
    }[];
}>(graph: T, locale?: Locale): T;
/** Get locale display name */
export declare function getLocaleName(locale?: Locale): string;
/** List all available locales */
export declare function listLocales(): {
    code: Locale;
    name: string;
}[];
//# sourceMappingURL=i18n.d.ts.map