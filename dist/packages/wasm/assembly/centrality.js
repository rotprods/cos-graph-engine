"use strict";
// Betweenness Centrality — AssemblyScript
// Brandes algorithm. Opera sobre CSR arrays.
Object.defineProperty(exports, "__esModule", { value: true });
exports.betweenness = betweenness;
function betweenness(indptrPtr, indptrLen, indicesPtr, indicesLen, resultPtr) {
    const n = indptrLen - 1;
    if (n <= 0)
        return;
    // Inicializar resultado a 0
    for (let i = 0; i < n; i++) {
        store(resultPtr + i * 8, 0.0);
    }
    // Buffers temporales
    const stackPtr = heap.alloc(n * 4);
    const queuePtr = heap.alloc(n * 4);
    const distPtr = heap.alloc(n * 4);
    const sigmaPtr = heap.alloc(n * 4);
    const deltaPtr = heap.alloc(n * 8);
    for (let s = 0; s < n; s++) {
        // Inicializar
        for (let i = 0; i < n; i++) {
            store(distPtr + i * 4, -1);
            store(sigmaPtr + i * 4, 0);
            store(deltaPtr + i * 8, 0.0);
        }
        store(sigmaPtr + s * 4, 1);
        store(distPtr + s * 4, 0);
        let stackTop = 0;
        let queueHead = 0;
        let queueTail = 0;
        store(queuePtr + queueTail * 4, s);
        queueTail += 1;
        while (queueHead < queueTail) {
            const v = load(queuePtr + queueHead * 4);
            queueHead += 1;
            store(stackPtr + stackTop * 4, v);
            stackTop += 1;
            const vStart = load(indptrPtr + v * 4);
            const vEnd = load(indptrPtr + (v + 1) * 4);
            let j = vStart;
            while (j < vEnd) {
                const w = load(indicesPtr + j * 4);
                const wDist = load(distPtr + w * 4);
                if (wDist < 0) {
                    store(queuePtr + queueTail * 4, w);
                    queueTail += 1;
                    store(distPtr + w * 4, load(distPtr + v * 4) + 1);
                }
                if (load(distPtr + w * 4) == load(distPtr + v * 4) + 1) {
                    store(sigmaPtr + w * 4, load(sigmaPtr + w * 4) + load(sigmaPtr + v * 4));
                }
                j += 1;
            }
        }
        // Accumulation
        while (stackTop > 0) {
            stackTop -= 1;
            const w = load(stackPtr + stackTop * 4);
            if (w != s) {
                const wStart = load(indptrPtr + w * 4);
                const wEnd = load(indptrPtr + (w + 1) * 4);
                let j = wStart;
                while (j < wEnd) {
                    const v = load(indicesPtr + j * 4);
                    if (load(distPtr + v * 4) == load(distPtr + w * 4) - 1) {
                        const sv = load(sigmaPtr + v * 4);
                        const sw = load(sigmaPtr + w * 4);
                        if (sv > 0) {
                            const contrib = f64(sw) / f64(sv) * (1.0 + load(deltaPtr + w * 8));
                            store(deltaPtr + v * 8, load(deltaPtr + v * 8) + contrib);
                        }
                    }
                    j += 1;
                }
            }
            if (w != s) {
                const cur = load(resultPtr + w * 8);
                store(resultPtr + w * 8, cur + load(deltaPtr + w * 8));
            }
        }
    }
    heap.free(stackPtr);
    heap.free(queuePtr);
    heap.free(distPtr);
    heap.free(sigmaPtr);
    heap.free(deltaPtr);
}
//# sourceMappingURL=centrality.js.map