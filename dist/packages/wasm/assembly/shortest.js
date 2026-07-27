"use strict";
// Shortest Path (BFS) — AssemblyScript
// Unweighted: uses BFS queue for O(n + e) performance.
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortestPath = shortestPath;
function shortestPath(indptrPtr, indptrLen, indicesPtr, indicesLen, source, target, resultPtr) {
    const n = indptrLen - 1;
    if (source < 0 || source >= n || target < 0 || target >= n)
        return -1;
    if (source == target) {
        store(resultPtr, 1);
        store(resultPtr + 4, 0);
        return 1;
    }
    // BFS queue
    const queuePtr = __alloc(n * 4);
    const distPtr = __alloc(n * 4);
    memory.fill(distPtr, 0xFF, n * 4); // -1 = unvisited
    let head = 0;
    let tail = 0;
    store(queuePtr + tail * 4, source);
    tail += 1;
    store(distPtr + source * 4, 0);
    let found = 0;
    let distance = -1;
    while (head < tail && found == 0) {
        const node = load(queuePtr + head * 4);
        head += 1;
        const nodeDist = load(distPtr + node * 4);
        const start = load(indptrPtr + node * 4);
        const end = load(indptrPtr + (node + 1) * 4);
        let j = start;
        while (j < end && found == 0) {
            const neighbor = load(indicesPtr + j * 4);
            if (load(distPtr + neighbor * 4) < 0) {
                store(distPtr + neighbor * 4, nodeDist + 1);
                if (neighbor == target) {
                    found = 1;
                    distance = nodeDist + 1;
                }
                else {
                    store(queuePtr + tail * 4, neighbor);
                    tail += 1;
                }
            }
            j += 1;
        }
    }
    store(resultPtr, found);
    store(resultPtr + 4, distance);
    __free(queuePtr);
    __free(distPtr);
    return found;
}
function __alloc(size) {
    return heap.alloc(size);
}
function __free(ptr) {
    heap.free(ptr);
}
//# sourceMappingURL=shortest.js.map