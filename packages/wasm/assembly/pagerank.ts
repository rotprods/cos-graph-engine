// PageRank — AssemblyScript
// Power iteration over outgoing CSR adjacency. Rank is distributed from each source to its targets.

export function pageRank(
  indptrPtr: usize, indptrLen: i32,
  indicesPtr: usize, indicesLen: i32,
  damping: f64,
  iterations: i32,
  resultPtr: usize
): void {
  const n = indptrLen - 1;
  if (n <= 0) return;

  const initialRank: f64 = 1.0 / f64(n);

  let rankPtr = heap.alloc(n * 8);
  let newRankPtr = heap.alloc(n * 8);

  for (let i: i32 = 0; i < n; i++) {
    store<f64>(rankPtr + i * 8, initialRank);
  }

  for (let iter: i32 = 0; iter < iterations; iter++) {
    let danglingSum: f64 = 0.0;
    for (let source: i32 = 0; source < n; source++) {
      const start = load<i32>(indptrPtr + source * 4);
      const end = load<i32>(indptrPtr + (source + 1) * 4);
      if (start == end) {
        danglingSum += load<f64>(rankPtr + source * 8);
      }
    }

    const baseRank = (1.0 - damping) / f64(n) + (damping * danglingSum) / f64(n);
    for (let i: i32 = 0; i < n; i++) {
      store<f64>(newRankPtr + i * 8, baseRank);
    }

    for (let source: i32 = 0; source < n; source++) {
      const start = load<i32>(indptrPtr + source * 4);
      const end = load<i32>(indptrPtr + (source + 1) * 4);
      const outDegree = end - start;
      if (outDegree == 0) continue;

      const contribution = damping * load<f64>(rankPtr + source * 8) / f64(outDegree);
      let j = start;
      while (j < end) {
        const target = load<i32>(indicesPtr + j * 4);
        const current = load<f64>(newRankPtr + target * 8);
        store<f64>(newRankPtr + target * 8, current + contribution);
        j += 1;
      }
    }

    const tmp = rankPtr;
    rankPtr = newRankPtr;
    newRankPtr = tmp;
  }

  for (let i: i32 = 0; i < n; i++) {
    store<f64>(resultPtr + i * 8, load<f64>(rankPtr + i * 8));
  }

  heap.free(rankPtr);
  heap.free(newRankPtr);
}
