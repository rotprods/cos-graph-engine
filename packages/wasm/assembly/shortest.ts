// Shortest Path (BFS) — AssemblyScript
// Unweighted: uses BFS queue for O(n + e) performance.

export function shortestPath(
  indptrPtr: usize, indptrLen: i32,
  indicesPtr: usize, indicesLen: i32,
  source: i32,
  target: i32,
  resultPtr: usize
): i32 {
  const n = indptrLen - 1;
  if (source < 0 || source >= n || target < 0 || target >= n) return -1;
  if (source == target) {
    store<i32>(resultPtr, 1);
    store<i32>(resultPtr + 4, 0);
    return 1;
  }

  // BFS queue
  const queuePtr = __alloc(n * 4);
  const distPtr = __alloc(n * 4);
  memory.fill(distPtr, 0xFF, n * 4); // -1 = unvisited

  let head: i32 = 0;
  let tail: i32 = 0;

  store<i32>(queuePtr + tail * 4, source);
  tail += 1;
  store<i32>(distPtr + source * 4, 0);

  let found: i32 = 0;
  let distance: i32 = -1;

  while (head < tail && found == 0) {
    const node = load<i32>(queuePtr + head * 4);
    head += 1;
    const nodeDist = load<i32>(distPtr + node * 4);

    const start = load<i32>(indptrPtr + node * 4);
    const end = load<i32>(indptrPtr + (node + 1) * 4);

    let j = start;
    while (j < end && found == 0) {
      const neighbor = load<i32>(indicesPtr + j * 4);

      if (load<i32>(distPtr + neighbor * 4) < 0) {
        store<i32>(distPtr + neighbor * 4, nodeDist + 1);
        if (neighbor == target) {
          found = 1;
          distance = nodeDist + 1;
        } else {
          store<i32>(queuePtr + tail * 4, neighbor);
          tail += 1;
        }
      }
      j += 1;
    }
  }

  store<i32>(resultPtr, found);
  store<i32>(resultPtr + 4, distance);

  __free(queuePtr);
  __free(distPtr);

  return found;
}

function __alloc(size: usize): usize {
  return heap.alloc(size);
}

function __free(ptr: usize): void {
  heap.free(ptr);
}