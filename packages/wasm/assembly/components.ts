// Connected components — AssemblyScript
// Union-Find / Disjoint Set Union (DSU) with explicit linear-memory ABI.

class DSU {
  parent: StaticArray<u32>;
  rank: StaticArray<u32>;

  constructor(n: u32) {
    this.parent = new StaticArray<u32>(n);
    this.rank = new StaticArray<u32>(n);
    for (let i: u32 = 0; i < n; i++) {
      this.parent[i] = i;
      this.rank[i] = 0;
    }
  }

  find(x: u32): u32 {
    if (this.parent[x] != x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  union(a: u32, b: u32): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra == rb) return;
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else {
      this.parent[rb] = ra;
      this.rank[ra] += 1;
    }
  }
}

function computeComponents(
  offsetsPtr: usize,
  offsetsLen: i32,
  edgesPtr: usize,
  edgesLen: i32,
  componentIdsPtr: usize
): u32 {
  const numNodes = offsetsLen - 1;
  if (numNodes <= 0) return 0;
  const dsu = new DSU(<u32>numNodes);

  for (let node: i32 = 0; node < numNodes; node++) {
    const start = load<i32>(offsetsPtr + node * 4);
    const end = load<i32>(offsetsPtr + (node + 1) * 4);
    for (let i = start; i < end; i++) {
      if (i < 0 || i >= edgesLen) continue;
      const neighbor = load<i32>(edgesPtr + i * 4);
      if (neighbor >= 0 && neighbor < numNodes) dsu.union(<u32>node, <u32>neighbor);
    }
  }

  const roots = new StaticArray<u32>(numNodes);
  let compCount: u32 = 0;
  for (let i: i32 = 0; i < numNodes; i++) {
    const root = dsu.find(<u32>i);
    let component: i32 = -1;
    for (let j: u32 = 0; j < compCount; j++) {
      if (roots[j] == root) { component = <i32>j; break; }
    }
    if (component < 0) {
      roots[compCount] = root;
      component = <i32>compCount;
      compCount++;
    }
    store<i32>(componentIdsPtr + i * 4, component);
  }
  return compCount;
}

export function connectedComponents(
  offsetsPtr: usize,
  offsetsLen: i32,
  edgesPtr: usize,
  edgesLen: i32,
  componentIdsPtr: usize
): u32 {
  return computeComponents(offsetsPtr, offsetsLen, edgesPtr, edgesLen, componentIdsPtr);
}

export function componentSize(
  offsetsPtr: usize,
  offsetsLen: i32,
  edgesPtr: usize,
  edgesLen: i32,
  component: u32
): u32 {
  const numNodes = offsetsLen - 1;
  if (numNodes <= 0) return 0;
  const idsPtr = heap.alloc(numNodes * 4);
  const compCount = computeComponents(offsetsPtr, offsetsLen, edgesPtr, edgesLen, idsPtr);
  if (component >= compCount) {
    heap.free(idsPtr);
    return 0;
  }
  let size: u32 = 0;
  for (let i: i32 = 0; i < numNodes; i++) {
    if (<u32>load<i32>(idsPtr + i * 4) == component) size++;
  }
  heap.free(idsPtr);
  return size;
}
