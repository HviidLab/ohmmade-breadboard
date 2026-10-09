// Dense LU solve with partial pivoting. Circuits here have at most a few hundred unknowns.
(function (BB) {
  "use strict";

  // Solve A x = b in place. A: Float64Array (n*n, row-major, destroyed). b: Float64Array (n, becomes x).
  // Returns false when the matrix is singular.
  function solve(A, b, n) {
    for (let k = 0; k < n; k++) {
      let p = k, max = Math.abs(A[k * n + k]);
      for (let r = k + 1; r < n; r++) {
        const v = Math.abs(A[r * n + k]);
        if (v > max) { max = v; p = r; }
      }
      if (max < 1e-300) return false;
      if (p !== k) {
        for (let c = k; c < n; c++) { const t = A[k * n + c]; A[k * n + c] = A[p * n + c]; A[p * n + c] = t; }
        const t = b[k]; b[k] = b[p]; b[p] = t;
      }
      const piv = A[k * n + k];
      for (let r = k + 1; r < n; r++) {
        const f = A[r * n + k] / piv;
        if (f === 0) continue;
        A[r * n + k] = 0;
        for (let c = k + 1; c < n; c++) A[r * n + c] -= f * A[k * n + c];
        b[r] -= f * b[k];
      }
    }
    for (let k = n - 1; k >= 0; k--) {
      let s = b[k];
      for (let c = k + 1; c < n; c++) s -= A[k * n + c] * b[c];
      b[k] = s / A[k * n + k];
    }
    return true;
  }

  BB.LinAlg = { solve };
})(window.BB = window.BB || {});
