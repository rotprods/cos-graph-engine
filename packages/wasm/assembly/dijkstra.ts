// Dijkstra shortest path — AssemblyScript
// Single-source shortest path using priority queue (array-based)

class MinHeap {
  data: StaticArray<u32>;
  dist: StaticArray<u32>;
  size: u32;

  constructor(capacity: u32) {
    this.data = new StaticArray<u32>(capacity);
    this.dist = new StaticArray<u32>(capacity);
    this.size = 0;
  }

  push(node: u32, d: u32): void {
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

  pop(): u32 {
    const result = this.data[0];
    this.size--;
    this.data[0] = this.data[this.size];
    this.dist[0] = this.dist[this.size];
    let i: u32 = 0;

    while (true) {
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
  offsets: StaticArray<u32>,
  edges: StaticArray<u32>,
  edgeWeights: StaticArray<u32>,
  source: u32,
  numNodes: u32,
  distances: StaticArray<u32>,
  parents: StaticArray<u32>
): u32 {
  const INF: u32 = u32.MAX_VALUE;
  const visited = new StaticArray<bool>(numNodes);

  for (let i: u32 = 0; i < numNodes; i++) {
    distances[i] = INF;
    parents[i] = numNodes;
    visited[i] = false;
  }

  distances[source] = 0;
  const heap = new MinHeap(numNodes);
  heap.push(source, 0);

  let settled: u32 = 0;

  while (!heap.empty()) {
    const node = heap.pop();
    if (visited[node]) continue;
    visited[node] = true;
    settled++;

    const start = offsets[node];
    const end = offsets[node + 1];
    for (let i = start; i < end; i++) {
      const neighbor = edges[i];
      const weight = edgeWeights[i];
      const newDist = distances[node] + weight;
      if (newDist < distances[neighbor]) {
        distances[neighbor] = newDist;
        parents[neighbor] = node;
        heap.push(neighbor, newDist);
      }
    }
  }
  return settled;
}

export function reconstructPath(
  parents: StaticArray<u32>,
  target: u32,
  output: StaticArray<u32>
): u32 {
  let idx: u32 = 0;
  let cur: u32 = target;
  const parentCount: u32 = <u32>parents.length;
  const temp = new StaticArray<u32>(parents.length);

  while (cur < parentCount) {
    temp[idx++] = cur;
    if (parents[cur] >= parentCount) break;
    cur = parents[cur];
  }

  // Reverse
  for (let i: u32 = 0; i < idx; i++) {
    output[i] = temp[idx - 1 - i];
  }
  return idx;
}