// CSR BFS — AssemblyScript
// Opera sobre arrays Int32Array en memoria lineal.
// Usa allocation inline via heap.alloc (disponible en AS runtime).

let outputBuffer: usize = 0;

export function setOutputBuffer(ptr: usize): void {
  outputBuffer = ptr;
}

export function bfs(
  indptrPtr: usize, indptrLen: i32,
  indicesPtr: usize, indicesLen: i32,
  source: i32
): i32 {
  const maxNodes = indptrLen - 1;
  if (source < 0 || source >= maxNodes) return 0;

  // Allocate buffers on the heap
  const visitedBytes = (maxNodes + 7) / 8;
  const visitedPtr = __alloc(visitedBytes);
  memory.fill(visitedPtr, 0, visitedBytes);

  const queueBytes = maxNodes * 4;
  const queuePtr = __alloc(queueBytes);
  let head: i32 = 0;
  let tail: i32 = 0;

  // Mark source as visited
  let byteIdx = source >> 3;
  let bitIdx = source & 7;
  store<u8>(visitedPtr + byteIdx, load<u8>(visitedPtr + byteIdx) | (1 << bitIdx as i32));

  // Enqueue source
  store<i32>(queuePtr + tail * 4, source);
  tail += 1;

  let visitedCount: i32 = 1;
  if (outputBuffer != 0) {
    store<i32>(outputBuffer, source);
  }

  while (head < tail) {
    const node = load<i32>(queuePtr + head * 4);
    head += 1;

    const start = load<i32>(indptrPtr + node * 4);
    const end = load<i32>(indptrPtr + (node + 1) * 4);

    let j = start;
    while (j < end) {
      const neighbor = load<i32>(indicesPtr + j * 4);

      const nb = neighbor >> 3;
      const nbit = neighbor & 7;
      if ((load<u8>(visitedPtr + nb) & (1 << nbit as i32)) == 0) {
        store<u8>(visitedPtr + nb, load<u8>(visitedPtr + nb) | (1 << nbit as i32));
        store<i32>(queuePtr + tail * 4, neighbor);
        tail += 1;

        if (outputBuffer != 0) {
          store<i32>(outputBuffer + visitedCount * 4, neighbor);
        }
        visitedCount += 1;
      }
      j += 1;
    }
  }

  __free(visitedPtr);
  __free(queuePtr);

  return visitedCount;
}

// Internal alloc/free (uses AS runtime heap)
function __alloc(size: usize): usize {
  return heap.alloc(size);
}

function __free(ptr: usize): void {
  heap.free(ptr);
}