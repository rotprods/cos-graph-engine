/**
 * AutoML — Fase 15 (T-15.3)
 *
 * Busqueda automatica de arquitectura de redes neuronales (L7)
 * y optimizacion de hiperparametros sobre grafos.
 *
 * Zero dependencias externas.
 */
export interface Architecture {
    id: string;
    layers: LayerConfig[];
    hiddenDim: number;
    learningRate: number;
    dropout: number;
    score: number;
}
export interface LayerConfig {
    type: 'dense' | 'relu' | 'tanh' | 'sigmoid' | 'dropout';
    units: number;
}
export interface HyperParameterSearchResult {
    bestArchitecture: Architecture;
    allArchitectures: Architecture[];
    searchIterations: number;
    bestScore: number;
    searchTime: number;
}
/**
 * Busca automaticamente la mejor arquitectura de red para un problema dado.
 * Genera N arquitecturas aleatorias, las evalua, y retorna la mejor.
 */
export declare class ArchitectureSearch {
    private architectures;
    private gcn;
    constructor();
    /**
     * Genera una arquitectura aleatoria.
     */
    private randomArchitecture;
    /**
     * Evalua una arquitectura usando L7's ComputationalGraph.
     * Construye un MLP con la arquitectura dada y evalua el forward pass.
     * Score = 1 / (1 + loss), donde loss viene del MLP.
     */
    private evaluateArchitecture;
    /**
     * Busca la mejor arquitectura evaluando N candidatos.
     */
    search(numCandidates?: number): HyperParameterSearchResult;
    /**
     * Busca con un presupuesto de tiempo en ms.
     */
    searchWithBudget(timeBudgetMs: number): HyperParameterSearchResult;
}
/**
 * Optimiza hiperparametros para un grafo L7 dado.
 * Usa busqueda aleatoria con evaluacion de forward pass.
 */
export declare class HyperParameterOptimizer {
    private graph;
    constructor();
    /**
     * Evalua un conjunto de hiperparametros construyendo un MLP
     * y midiendo el loss del forward pass.
     */
    evaluateParams(hiddenDim: number, learningRate: number, noise?: number): number;
    /**
     * Optimiza hiperparametros via random search.
     */
    optimize(iterations?: number): {
        bestHiddenDim: number;
        bestLearningRate: number;
        bestScore: number;
        results: Array<{
            hiddenDim: number;
            learningRate: number;
            score: number;
        }>;
    };
}
/**
 * Pipeline completo de AutoML.
 * 1. Busca la mejor arquitectura
 * 2. Optimiza hiperparametros
 * 3. Retorna configuracion optima
 */
export declare class AutoMLPipeline {
    private archSearch;
    private hpOptimizer;
    constructor();
    /**
     * Ejecuta AutoML completo.
     */
    run(numArchitectures?: number, hpIterations?: number): {
        bestArchitecture: HyperParameterSearchResult;
        bestParams: {
            bestHiddenDim: number;
            bestLearningRate: number;
            bestScore: number;
        };
        totalTime: number;
    };
}
//# sourceMappingURL=automl.d.ts.map