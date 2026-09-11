// DFS traversal on CSR graph — AssemblyScript
// Explicit linear-memory ABI for JS/WASM interop.

export function dfs(
  offsetsPtr: usize,
  offsetsLen: i32,
  edgesPtr: usize,
  edgesLen: i32,
  source: i32,
  outputPtr: usize
): i32 {
  const numNodes = offsetsLen - 1;
  if (numNodes <= 0 || source < 0 || source >= numNodes) return 0;

  const visited = new StaticArray<bool>(numNodes);
  const stack = new StaticArray<i32>(numNodes);
  let stackIdx: i32 = 0;
  let outIdx: i32 = 0;

  stack[stackIdx++] = source;

  while (stackIdx > 0) {
    const node = stack[--stackIdx];
    if (visited[node]) continue;
    visited[node] = true;
    store<i32>(outputPtr + outIdx * 4, node);
    outIdx++;

    // Match the JS fallback exactly: enqueue adjacency entries in CSR order.
    // Because this is a LIFO stack, the last neighbour is visited first.
    const start = load<i32>(offsetsPtr + node * 4);
    const end = load<i32>(offsetsPtr + (node + 1) * 4);
    for (let i = start; i < end; i++) {
      if (i < 0 || i >= edgesLen) continue;
      const neighbor = load<i32>(edgesPtr + i * 4);
      if (neighbor >= 0 && neighbor < numNodes && !visited[neighbor]) {
        stack[stackIdx++] = neighbor;
      }
    }
  }
  return outIdx;
}

export function dfsHasPath(
  offsetsPtr: usize,
  offsetsLen: i32,
  edgesPtr: usize,
  edgesLen: i32,
  source: i32,
  target: i32
): bool {
  const numNodes = offsetsLen - 1;
  if (numNodes <= 0 || source < 0 || source >= numNodes || target < 0 || target >= numNodes) return false;
  if (source == target) return true;

  const visited = new StaticArray<bool>(numNodes);
  const stack = new StaticArray<i32>(numNodes);
  let stackIdx: i32 = 0;
  stack[stackIdx++] = source;

  while (stackIdx > 0) {
    const node = stack[--stackIdx];
    if (visited[node]) continue;
    visited[node] = true;
    const start = load<i32>(offsetsPtr + node * 4);
    const end = load<i32>(offsetsPtr + (node + 1) * 4);
    for (let i = start; i < end; i++) {
      if (i < 0 || i >= edgesLen) continue;
      const neighbor = load<i32>(edgesPtr + i * 4);
      if (neighbor == target) return true;
      if (neighbor >= 0 && neighbor < numNodes && !visited[neighbor]) stack[stackIdx++] = neighbor;
    }
  }
  return false;
}
