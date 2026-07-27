// Connected components — AssemblyScript
// Union-Find / Disjoint Set Union (DSU) for finding connected components

class DSU {
  parent: StaticArray<u32>;
  rank: StaticArray<u32>;
  size: u32;

  constructor(n: u32) {
    this.parent = new StaticArray<u32>(n);
    this.rank = new StaticArray<u32>(n);
    this.size = n;
    for (let i: u32 = 0; i < n; i++) {
      this.parent[i] = i;
      this.rank[i] = 0;
    }
  }

  find(x: u32): u32 {
    if (this.parent[x] != x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  union(a: u32, b: u32): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra == rb) return;
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra] += 1;
    }
  }
}

export function connectedComponents(
  offsets: StaticArray<u32>,
  edges: StaticArray<u32>,
  numNodes: u32,
  componentIds: StaticArray<u32>
): u32 {
  const dsu = new DSU(numNodes);

  for (let node: u32 = 0; node < numNodes; node++) {
    const start = offsets[node];
    const end = offsets[node + 1];
    for (let i = start; i < end; i++) {
      dsu.union(node, edges[i]);
    }
  }

  // Compress and assign component IDs
  const compMap = new StaticArray<u32>(numNodes);
  let compCount: u32 = 0;

  for (let i: u32 = 0; i < numNodes; i++) {
    const root = dsu.find(i);
    let found = false;
    for (let j: u32 = 0; j < compCount; j++) {
      if (compMap[j] == root) {
        componentIds[i] = j;
        found = true;
        break;
      }
    }
    if (!found) {
      compMap[compCount] = root;
      componentIds[i] = compCount;
      compCount++;
    }
  }
  return compCount;
}

export function componentSize(
  offsets: StaticArray<u32>,
  edges: StaticArray<u32>,
  numNodes: u32,
  component: u32
): u32 {
  const compIds = new StaticArray<u32>(numNodes);
  const compCount = connectedComponents(offsets, edges, numNodes, compIds);
  if (component >= compCount) return 0;
  let size: u32 = 0;
  for (let i: u32 = 0; i < numNodes; i++) {
    if (compIds[i] == component) size++;
  }
  return size;
}