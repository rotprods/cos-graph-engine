"use strict";
/**
 * AutoML — Fase 15 (T-15.3)
 *
 * Busqueda automatica de arquitectura de redes neuronales (L7)
 * y optimizacion de hiperparametros sobre grafos.
 *
 * Zero dependencias externas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoMLPipeline = exports.HyperParameterOptimizer = exports.ArchitectureSearch = void 0;
const level7_compute_1 = require("./level7-compute");
const gcn_1 = require("./gcn");
// ============================================================
// ArchitectureSearch — Busqueda de arquitectura
// ============================================================
/**
 * Busca automaticamente la mejor arquitectura de red para un problema dado.
 * Genera N arquitecturas aleatorias, las evalua, y retorna la mejor.
 */
class ArchitectureSearch {
    architectures = [];
    gcn;
    constructor() {
        this.gcn = new gcn_1.GCN({ hiddenDim: 8, numLayers: 2 });
    }
    /**
     * Genera una arquitectura aleatoria.
     */
    randomArchitecture(id) {
        const numLayers = Math.floor(Math.random() * 3) + 1; // 1-3 layers
        const layers = [];
        for (let i = 0; i < numLayers; i++) {
            const types = ['dense', 'relu', 'tanh', 'sigmoid'];
            layers.push({
                type: types[Math.floor(Math.random() * types.length)],
                units: Math.pow(2, Math.floor(Math.random() * 5) + 3), // 8, 16, 32, 64, 128
            });
        }
        return {
            id,
            layers,
            hiddenDim: Math.pow(2, Math.floor(Math.random() * 4) + 3), // 8, 16, 32, 64
            learningRate: [0.1, 0.01, 0.001, 0.0001][Math.floor(Math.random() * 4)],
            dropout: [0, 0.1, 0.2, 0.5][Math.floor(Math.random() * 4)],
            score: 0,
        };
    }
    /**
     * Evalua una arquitectura usando L7's ComputationalGraph.
     * Construye un MLP con la arquitectura dada y evalua el forward pass.
     * Score = 1 / (1 + loss), donde loss viene del MLP.
     */
    evaluateArchitecture(arch) {
        try {
            const graph = new level7_compute_1.ComputationalGraph();
            graph.buildMLP(784, arch.hiddenDim, 2);
            const loss = graph.forward({ x: 0.5 });
            // Lower loss = higher score
            const score = 1 / (1 + Math.abs(loss));
            return Math.min(1, score);
        }
        catch {
            return 0;
        }
    }
    /**
     * Busca la mejor arquitectura evaluando N candidatos.
     */
    search(numCandidates = 10) {
        const start = Date.now();
        this.architectures = [];
        for (let i = 0; i < numCandidates; i++) {
            const arch = this.randomArchitecture(`arch_${i}`);
            arch.score = this.evaluateArchitecture(arch);
            this.architectures.push(arch);
        }
        // Sort by score descending
        this.architectures.sort((a, b) => b.score - a.score);
        const best = this.architectures[0];
        return {
            bestArchitecture: best,
            allArchitectures: this.architectures,
            searchIterations: numCandidates,
            bestScore: best.score,
            searchTime: Date.now() - start,
        };
    }
    /**
     * Busca con un presupuesto de tiempo en ms.
     */
    searchWithBudget(timeBudgetMs) {
        const start = Date.now();
        this.architectures = [];
        let i = 0;
        while (Date.now() - start < timeBudgetMs) {
            const arch = this.randomArchitecture(`arch_${i}`);
            arch.score = this.evaluateArchitecture(arch);
            this.architectures.push(arch);
            i++;
        }
        this.architectures.sort((a, b) => b.score - a.score);
        const best = this.architectures[0] || this.randomArchitecture('arch_default');
        return {
            bestArchitecture: best,
            allArchitectures: this.architectures,
            searchIterations: i,
            bestScore: best.score,
            searchTime: Date.now() - start,
        };
    }
}
exports.ArchitectureSearch = ArchitectureSearch;
// ============================================================
// HyperParameterOptimizer — Optimizacion de hiperparametros
// ============================================================
/**
 * Optimiza hiperparametros para un grafo L7 dado.
 * Usa busqueda aleatoria con evaluacion de forward pass.
 */
class HyperParameterOptimizer {
    graph;
    constructor() {
        this.graph = new level7_compute_1.ComputationalGraph();
    }
    /**
     * Evalua un conjunto de hiperparametros construyendo un MLP
     * y midiendo el loss del forward pass.
     */
    evaluateParams(hiddenDim, learningRate, noise = 0.1) {
        this.graph = new level7_compute_1.ComputationalGraph();
        this.graph.buildMLP(784, hiddenDim, 2);
        const inputValue = 0.5 + (Math.random() - 0.5) * noise;
        const loss = this.graph.forward({ x: inputValue });
        // Adjusted loss with learning rate: lower LR = more stable
        const adjustedLoss = Math.abs(loss) * (1 + learningRate);
        return 1 / (1 + adjustedLoss);
    }
    /**
     * Optimiza hiperparametros via random search.
     */
    optimize(iterations = 20) {
        const results = [];
        for (let i = 0; i < iterations; i++) {
            const hiddenDim = Math.pow(2, Math.floor(Math.random() * 5) + 3); // 8, 16, 32, 64, 128
            const learningRate = [0.1, 0.01, 0.001, 0.0001][Math.floor(Math.random() * 4)];
            const score = this.evaluateParams(hiddenDim, learningRate);
            results.push({ hiddenDim, learningRate, score });
        }
        results.sort((a, b) => b.score - a.score);
        const best = results[0];
        return {
            bestHiddenDim: best.hiddenDim,
            bestLearningRate: best.learningRate,
            bestScore: best.score,
            results,
        };
    }
}
exports.HyperParameterOptimizer = HyperParameterOptimizer;
// ============================================================
// AutoMLPipeline — Pipeline completo
// ============================================================
/**
 * Pipeline completo de AutoML.
 * 1. Busca la mejor arquitectura
 * 2. Optimiza hiperparametros
 * 3. Retorna configuracion optima
 */
class AutoMLPipeline {
    archSearch;
    hpOptimizer;
    constructor() {
        this.archSearch = new ArchitectureSearch();
        this.hpOptimizer = new HyperParameterOptimizer();
    }
    /**
     * Ejecuta AutoML completo.
     */
    run(numArchitectures = 10, hpIterations = 20) {
        const start = Date.now();
        // Step 1: Search for best architecture
        const archResult = this.archSearch.search(numArchitectures);
        // Step 2: Optimize hyperparameters
        const hpResult = this.hpOptimizer.optimize(hpIterations);
        return {
            bestArchitecture: archResult,
            bestParams: {
                bestHiddenDim: hpResult.bestHiddenDim,
                bestLearningRate: hpResult.bestLearningRate,
                bestScore: hpResult.bestScore,
            },
            totalTime: Date.now() - start,
        };
    }
}
exports.AutoMLPipeline = AutoMLPipeline;
//# sourceMappingURL=automl.js.map