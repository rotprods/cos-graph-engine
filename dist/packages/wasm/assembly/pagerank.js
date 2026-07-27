"use strict";
// PageRank — AssemblyScript
// Power iteration method. Opera sobre CSR arrays en memoria lineal.
Object.defineProperty(exports, "__esModule", { value: true });
exports.pageRank = pageRank;
function pageRank(indptrPtr, indptrLen, indicesPtr, indicesLen, damping, iterations, resultPtr) {
    const n = indptrLen - 1;
    if (n <= 0)
        return;
    const initRank = 1.0 / f64(n);
    const danglingRank = damping * initRank;
    // Ranks actual y nuevo
    let rankPtr = heap.alloc(n * 8);
    let newRankPtr = heap.alloc(n * 8);
    // Inicializar ranks
    for (let i = 0; i < n; i++) {
        store(rankPtr + i * 8, initRank);
    }
    for (let iter = 0; iter < iterations; iter++) {
        // Calcular rank dangling
        let danglingSum = 0.0;
        for (let i = 0; i < n; i++) {
            const start = load(indptrPtr + i * 4);
            const end = load(indptrPtr + (i + 1) * 4);
            if (start == end) {
                danglingSum += load(rankPtr + i * 8);
            }
        }
        const baseRank = (1.0 - damping) / f64(n);
        for (let i = 0; i < n; i++) {
            let sum = 0.0;
            const start = load(indptrPtr + i * 4);
            const end = load(indptrPtr + (i + 1) * 4);
            let j = start;
            while (j < end) {
                const neighbor = load(indicesPtr + j * 4);
                const nStart = load(indptrPtr + neighbor * 4);
                const nEnd = load(indptrPtr + (neighbor + 1) * 4);
                const outDegree = nEnd - nStart;
                if (outDegree > 0) {
                    sum += load(rankPtr + neighbor * 8) / f64(outDegree);
                }
                j += 1;
            }
            store(newRankPtr + i * 8, baseRank + damping * sum + danglingRank * danglingSum);
        }
        // Swap
        const tmp = rankPtr;
        rankPtr = newRankPtr;
        newRankPtr = tmp;
    }
    // Copiar resultado
    for (let i = 0; i < n; i++) {
        store(resultPtr + i * 8, load(rankPtr + i * 8));
    }
    heap.free(rankPtr);
    heap.free(newRankPtr);
}
//# sourceMappingURL=pagerank.js.map