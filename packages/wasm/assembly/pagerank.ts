// PageRank — AssemblyScript
// Power iteration method. Opera sobre CSR arrays en memoria lineal.

export function pageRank(
  indptrPtr: usize, indptrLen: i32,
  indicesPtr: usize, indicesLen: i32,
  damping: f64,
  iterations: i32,
  resultPtr: usize
): void {
  const n = indptrLen - 1;
  if (n <= 0) return;

  const initRank: f64 = 1.0 / f64(n);
  const danglingRank: f64 = damping * initRank;

  // Ranks actual y nuevo
  let rankPtr = heap.alloc(n * 8);
  let newRankPtr = heap.alloc(n * 8);

  // Inicializar ranks
  for (let i: i32 = 0; i < n; i++) {
    store<f64>(rankPtr + i * 8, initRank);
  }

  for (let iter: i32 = 0; iter < iterations; iter++) {
    // Calcular rank dangling
    let danglingSum: f64 = 0.0;
    for (let i: i32 = 0; i < n; i++) {
      const start = load<i32>(indptrPtr + i * 4);
      const end = load<i32>(indptrPtr + (i + 1) * 4);
      if (start == end) {
        danglingSum += load<f64>(rankPtr + i * 8);
      }
    }

    const baseRank = (1.0 - damping) / f64(n);

    for (let i: i32 = 0; i < n; i++) {
      let sum: f64 = 0.0;
      const start = load<i32>(indptrPtr + i * 4);
      const end = load<i32>(indptrPtr + (i + 1) * 4);

      let j = start;
      while (j < end) {
        const neighbor = load<i32>(indicesPtr + j * 4);
        const nStart = load<i32>(indptrPtr + neighbor * 4);
        const nEnd = load<i32>(indptrPtr + (neighbor + 1) * 4);
        const outDegree = nEnd - nStart;
        if (outDegree > 0) {
          sum += load<f64>(rankPtr + neighbor * 8) / f64(outDegree);
        }
        j += 1;
      }

      store<f64>(newRankPtr + i * 8, baseRank + damping * sum + danglingRank * danglingSum);
    }

    // Swap
    const tmp = rankPtr;
    rankPtr = newRankPtr;
    newRankPtr = tmp;
  }

  // Copiar resultado
  for (let i: i32 = 0; i < n; i++) {
    store<f64>(resultPtr + i * 8, load<f64>(rankPtr + i * 8));
  }

  heap.free(rankPtr);
  heap.free(newRankPtr);
}