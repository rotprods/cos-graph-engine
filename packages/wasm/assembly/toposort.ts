// Topological sort — AssemblyScript
// Kahn's algorithm using explicit linear-memory ABI.

export function topologicalSort(
  offsetsPtr: usize,
  offsetsLen: i32,
  edgesPtr: usize,
  edgesLen: i32,
  outputPtr: usize
): i32 {
  const numNodes = offsetsLen - 1;
  if (numNodes <= 0) return 0;
  const inDegree = new StaticArray<i32>(numNodes);
  const queue = new StaticArray<i32>(numNodes);
  let qHead: i32 = 0;
  let qTail: i32 = 0;
  let outIdx: i32 = 0;

  for (let node: i32 = 0; node < numNodes; node++) {
    const start = load<i32>(offsetsPtr + node * 4);
    const end = load<i32>(offsetsPtr + (node + 1) * 4);
    for (let i = start; i < end; i++) {
      if (i < 0 || i >= edgesLen) continue;
      const neighbor = load<i32>(edgesPtr + i * 4);
      if (neighbor >= 0 && neighbor < numNodes) inDegree[neighbor]++;
    }
  }

  for (let i: i32 = 0; i < numNodes; i++) {
    if (inDegree[i] == 0) queue[qTail++] = i;
  }

  while (qHead < qTail) {
    const node = queue[qHead++];
    store<i32>(outputPtr + outIdx * 4, node);
    outIdx++;

    const start = load<i32>(offsetsPtr + node * 4);
    const end = load<i32>(offsetsPtr + (node + 1) * 4);
    for (let i = start; i < end; i++) {
      if (i < 0 || i >= edgesLen) continue;
      const neighbor = load<i32>(edgesPtr + i * 4);
      if (neighbor < 0 || neighbor >= numNodes) continue;
      inDegree[neighbor]--;
      if (inDegree[neighbor] == 0) queue[qTail++] = neighbor;
    }
  }

  if (outIdx < numNodes) return 0;
  return outIdx;
}

export function hasCycle(
  offsetsPtr: usize,
  offsetsLen: i32,
  edgesPtr: usize,
  edgesLen: i32
): bool {
  const numNodes = offsetsLen - 1;
  if (numNodes <= 0) return false;
  const outputPtr = heap.alloc(numNodes * 4);
  const result = topologicalSort(offsetsPtr, offsetsLen, edgesPtr, edgesLen, outputPtr);
  heap.free(outputPtr);
  return result == 0;
}
