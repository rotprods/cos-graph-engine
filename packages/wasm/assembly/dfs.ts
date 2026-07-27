// DFS traversal on CSR graph — AssemblyScript
// Depth-first search with stack-based iteration

export function dfs(
  offsets: StaticArray<u32>,
  edges: StaticArray<u32>,
  source: u32,
  numNodes: u32,
  output: StaticArray<u32>
): u32 {
  const visited = new StaticArray<bool>(numNodes);
  const stack = new StaticArray<u32>(numNodes);
  let stackIdx: u32 = 0;
  let outIdx: u32 = 0;

  stack[stackIdx++] = source;

  while (stackIdx > 0) {
    const node = stack[--stackIdx];
    if (visited[node]) continue;
    visited[node] = true;
    output[outIdx++] = node;

    const start = offsets[node];
    const end = offsets[node + 1];
    let i = end;
    while (i > start) {
      i--;
      const neighbor = edges[i];
      if (!visited[neighbor]) {
        stack[stackIdx++] = neighbor;
      }
    }
  }
  return outIdx;
}

export function dfsHasPath(
  offsets: StaticArray<u32>,
  edges: StaticArray<u32>,
  source: u32,
  target: u32,
  numNodes: u32
): bool {
  if (source == target) return true;
  const visited = new StaticArray<bool>(numNodes);
  const stack = new StaticArray<u32>(numNodes);
  let stackIdx: u32 = 0;
  stack[stackIdx++] = source;

  while (stackIdx > 0) {
    const node = stack[--stackIdx];
    if (visited[node]) continue;
    visited[node] = true;
    const start = offsets[node];
    const end = offsets[node + 1];
    for (let i = start; i < end; i++) {
      const neighbor = edges[i];
      if (neighbor == target) return true;
      if (!visited[neighbor]) stack[stackIdx++] = neighbor;
    }
  }
  return false;
}