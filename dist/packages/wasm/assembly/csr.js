"use strict";
// CSR BFS — AssemblyScript
// Opera sobre arrays Int32Array en memoria lineal.
// Usa allocation inline via heap.alloc (disponible en AS runtime).
Object.defineProperty(exports, "__esModule", { value: true });
exports.setOutputBuffer = setOutputBuffer;
exports.bfs = bfs;
let outputBuffer = 0;
function setOutputBuffer(ptr) {
    outputBuffer = ptr;
}
function bfs(indptrPtr, indptrLen, indicesPtr, indicesLen, source) {
    const maxNodes = indptrLen - 1;
    if (source < 0 || source >= maxNodes)
        return 0;
    // Allocate buffers on the heap
    const visitedBytes = (maxNodes + 7) / 8;
    const visitedPtr = __alloc(visitedBytes);
    memory.fill(visitedPtr, 0, visitedBytes);
    const queueBytes = maxNodes * 4;
    const queuePtr = __alloc(queueBytes);
    let head = 0;
    let tail = 0;
    // Mark source as visited
    let byteIdx = source >> 3;
    let bitIdx = source & 7;
    store(visitedPtr + byteIdx, load(visitedPtr + byteIdx) | 1 << bitIdx);
    // Enqueue source
    store(queuePtr + tail * 4, source);
    tail += 1;
    let visitedCount = 1;
    if (outputBuffer != 0) {
        store(outputBuffer, source);
    }
    while (head < tail) {
        const node = load(queuePtr + head * 4);
        head += 1;
        const start = load(indptrPtr + node * 4);
        const end = load(indptrPtr + (node + 1) * 4);
        let j = start;
        while (j < end) {
            const neighbor = load(indicesPtr + j * 4);
            const nb = neighbor >> 3;
            const nbit = neighbor & 7;
            if ((load(visitedPtr + nb) & 1 << nbit) == 0) {
                store(visitedPtr + nb, load(visitedPtr + nb) | 1 << nbit);
                store(queuePtr + tail * 4, neighbor);
                tail += 1;
                if (outputBuffer != 0) {
                    store(outputBuffer + visitedCount * 4, neighbor);
                }
                visitedCount += 1;
            }
            j += 1;
        }
    }
    __free(visitedPtr);
    __free(queuePtr);
    return visitedCount;
}
// Internal alloc/free (uses AS runtime heap)
function __alloc(size) {
    return heap.alloc(size);
}
function __free(ptr) {
    heap.free(ptr);
}
//# sourceMappingURL=csr.js.map