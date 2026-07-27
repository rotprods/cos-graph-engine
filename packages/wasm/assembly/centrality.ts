// Betweenness Centrality — AssemblyScript
// Brandes algorithm. Opera sobre CSR arrays.

export function betweenness(
  indptrPtr: usize, indptrLen: i32,
  indicesPtr: usize, indicesLen: i32,
  resultPtr: usize
): void {
  const n = indptrLen - 1;
  if (n <= 0) return;

  // Inicializar resultado a 0
  for (let i: i32 = 0; i < n; i++) {
    store<f64>(resultPtr + i * 8, 0.0);
  }

  // Buffers temporales
  const stackPtr = heap.alloc(n * 4);
  const queuePtr = heap.alloc(n * 4);
  const distPtr = heap.alloc(n * 4);
  const sigmaPtr = heap.alloc(n * 4);
  const deltaPtr = heap.alloc(n * 8);

  for (let s: i32 = 0; s < n; s++) {
    // Inicializar
    for (let i: i32 = 0; i < n; i++) {
      store<i32>(distPtr + i * 4, -1);
      store<i32>(sigmaPtr + i * 4, 0);
      store<f64>(deltaPtr + i * 8, 0.0);
    }

    store<i32>(sigmaPtr + s * 4, 1);
    store<i32>(distPtr + s * 4, 0);

    let stackTop: i32 = 0;
    let queueHead: i32 = 0;
    let queueTail: i32 = 0;

    store<i32>(queuePtr + queueTail * 4, s);
    queueTail += 1;

    while (queueHead < queueTail) {
      const v = load<i32>(queuePtr + queueHead * 4);
      queueHead += 1;
      store<i32>(stackPtr + stackTop * 4, v);
      stackTop += 1;

      const vStart = load<i32>(indptrPtr + v * 4);
      const vEnd = load<i32>(indptrPtr + (v + 1) * 4);

      let j = vStart;
      while (j < vEnd) {
        const w = load<i32>(indicesPtr + j * 4);
        const wDist = load<i32>(distPtr + w * 4);

        if (wDist < 0) {
          store<i32>(queuePtr + queueTail * 4, w);
          queueTail += 1;
          store<i32>(distPtr + w * 4, load<i32>(distPtr + v * 4) + 1);
        }

        if (load<i32>(distPtr + w * 4) == load<i32>(distPtr + v * 4) + 1) {
          store<i32>(sigmaPtr + w * 4, load<i32>(sigmaPtr + w * 4) + load<i32>(sigmaPtr + v * 4));
        }
        j += 1;
      }
    }

    // Accumulation
    while (stackTop > 0) {
      stackTop -= 1;
      const w = load<i32>(stackPtr + stackTop * 4);
      if (w != s) {
        const wStart = load<i32>(indptrPtr + w * 4);
        const wEnd = load<i32>(indptrPtr + (w + 1) * 4);

        let j = wStart;
        while (j < wEnd) {
          const v = load<i32>(indicesPtr + j * 4);
          if (load<i32>(distPtr + v * 4) == load<i32>(distPtr + w * 4) - 1) {
            const sv = load<i32>(sigmaPtr + v * 4);
            const sw = load<i32>(sigmaPtr + w * 4);
            if (sv > 0) {
              const contrib = f64(sw) / f64(sv) * (1.0 + load<f64>(deltaPtr + w * 8));
              store<f64>(deltaPtr + v * 8, load<f64>(deltaPtr + v * 8) + contrib);
            }
          }
          j += 1;
        }
      }

      if (w != s) {
        const cur = load<f64>(resultPtr + w * 8);
        store<f64>(resultPtr + w * 8, cur + load<f64>(deltaPtr + w * 8));
      }
    }
  }

  heap.free(stackPtr);
  heap.free(queuePtr);
  heap.free(distPtr);
  heap.free(sigmaPtr);
  heap.free(deltaPtr);
}