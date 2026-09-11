// Dijkstra shortest path — AssemblyScript
// Explicit linear-memory ABI. Distances use signed i32 to match the JS loader/fallback.

class MinHeap {
  data: StaticArray<i32>;
  dist: StaticArray<i32>;
  size: i32;

  constructor(capacity: i32) {
    this.data = new StaticArray<i32>(capacity);
    this.dist = new StaticArray<i32>(capacity);
    this.size = 0;
  }

  push(node: i32, d: i32): void {
    let i = this.size;
    this.data[i] = node;
    this.dist[i] = d;
    this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.dist[parent] <= this.dist[i]) break;
      const tmpN = this.data[parent]; this.data[parent] = this.data[i]; this.data[i] = tmpN;
      const tmpD = this.dist[parent]; this.dist[parent] = this.dist[i]; this.dist[i] = tmpD;
      i = parent;
    }
  }

  pop(): i32 {
    const result = this.data[0];
    this.size--;
    if (this.size > 0) {
      this.data[0] = this.data[this.size];
      this.dist[0] = this.dist[this.size];
    }
    let i: i32 = 0;
    while (this.size > 0) {
      let smallest = i;
      const left = (i << 1) + 1;
      const right = (i << 1) + 2;
      if (left < this.size && this.dist[left] < this.dist[smallest]) smallest = left;
      if (right < this.size && this.dist[right] < this.dist[smallest]) smallest = right;
      if (smallest == i) break;
      const tmpN = this.data[i]; this.data[i] = this.data[smallest]; this.data[smallest] = tmpN;
      const tmpD = this.dist[i]; this.dist[i] = this.dist[smallest]; this.dist[smallest] = tmpD;
      i = smallest;
    }
    return result;
  }

  empty(): bool { return this.size == 0; }
}

export function dijkstra(
  offsetsPtr: usize,
  offsetsLen: i32,
  edgesPtr: usize,
  edgesLen: i32,
  weightsPtr: usize,
  weightsLen: i32,
  source: i32,
  distancesPtr: usize,
  parentsPtr: usize
): i32 {
  const numNodes = offsetsLen - 1;
  const INF: i32 = i32.MAX_VALUE;
  if (numNodes <= 0 || source < 0 || source >= numNodes) return 0;

  const visited = new StaticArray<bool>(numNodes);
  for (let i: i32 = 0; i < numNodes; i++) {
    store<i32>(distancesPtr + i * 4, INF);
    store<i32>(parentsPtr + i * 4, numNodes);
    visited[i] = false;
  }

  store<i32>(distancesPtr + source * 4, 0);
  const heap = new MinHeap(numNodes + edgesLen + 1);
  heap.push(source, 0);
  let settled: i32 = 0;

  while (!heap.empty()) {
    const node = heap.pop();
    if (node < 0 || node >= numNodes || visited[node]) continue;
    visited[node] = true;
    settled++;

    const current = load<i32>(distancesPtr + node * 4);
    const start = load<i32>(offsetsPtr + node * 4);
    const end = load<i32>(offsetsPtr + (node + 1) * 4);
    for (let i = start; i < end; i++) {
      if (i < 0 || i >= edgesLen || i >= weightsLen) continue;
      const neighbor = load<i32>(edgesPtr + i * 4);
      const weight = load<i32>(weightsPtr + i * 4);
      if (neighbor < 0 || neighbor >= numNodes || weight < 0 || current == INF) continue;
      if (current > INF - weight) continue;
      const newDist = current + weight;
      const oldDist = load<i32>(distancesPtr + neighbor * 4);
      if (newDist < oldDist) {
        store<i32>(distancesPtr + neighbor * 4, newDist);
        store<i32>(parentsPtr + neighbor * 4, node);
        heap.push(neighbor, newDist);
      }
    }
  }
  return settled;
}

export function reconstructPath(
  parentsPtr: usize,
  parentCount: i32,
  target: i32,
  outputPtr: usize
): i32 {
  if (target < 0 || target >= parentCount) return 0;
  const temp = new StaticArray<i32>(parentCount);
  let idx: i32 = 0;
  let cur = target;

  while (cur >= 0 && cur < parentCount && idx < parentCount) {
    temp[idx++] = cur;
    const parent = load<i32>(parentsPtr + cur * 4);
    if (parent < 0 || parent >= parentCount) break;
    cur = parent;
  }

  for (let i: i32 = 0; i < idx; i++) store<i32>(outputPtr + i * 4, temp[idx - 1 - i]);
  return idx;
}
