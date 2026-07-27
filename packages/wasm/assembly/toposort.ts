// Topological sort — AssemblyScript
// Kahn's algorithm for DAG topological ordering

export function topologicalSort(
  offsets: StaticArray<u32>,
  edges: StaticArray<u32>,
  numNodes: u32,
  output: StaticArray<u32>
): u32 {
  const inDegree = new StaticArray<u32>(numNodes);
  const queue = new StaticArray<u32>(numNodes);
  let qHead: u32 = 0;
  let qTail: u32 = 0;
  let outIdx: u32 = 0;

  // Compute in-degree
  for (let node: u32 = 0; node < numNodes; node++) {
    const start = offsets[node];
    const end = offsets[node + 1];
    for (let i = start; i < end; i++) {
      inDegree[edges[i]]++;
    }
  }

  // Enqueue nodes with in-degree 0
  for (let i: u32 = 0; i < numNodes; i++) {
    if (inDegree[i] == 0) {
      queue[qTail++] = i;
    }
  }

  // Process queue
  while (qHead < qTail) {
    const node = queue[qHead++];
    output[outIdx++] = node;

    const start = offsets[node];
    const end = offsets[node + 1];
    for (let i = start; i < end; i++) {
      const neighbor = edges[i];
      inDegree[neighbor]--;
      if (inDegree[neighbor] == 0) {
        queue[qTail++] = neighbor;
      }
    }
  }

  // If outIdx < numNodes, there's a cycle (return 0)
  if (outIdx < numNodes) return 0;
  return outIdx;
}

export function hasCycle(
  offsets: StaticArray<u32>,
  edges: StaticArray<u32>,
  numNodes: u32
): bool {
  const temp = new StaticArray<u32>(numNodes);
  const result = topologicalSort(offsets, edges, numNodes, temp);
  return result == 0;
}