interface Metric {
    name: string;
    category: 'performance' | 'reliability' | 'coverage' | 'quality' | 'security';
    target: number;
    actual: number;
    unit: string;
    passed: boolean;
}
declare const metrics: Metric[];
declare function measure(name: string, category: Metric['category'], target: number, actual: number, unit: string): void;
//# sourceMappingURL=metrics.d.ts.map