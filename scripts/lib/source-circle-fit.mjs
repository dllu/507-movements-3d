// Least-squares circle fit in coordinates centered at the sample mean.
export function circleFit(points) {
  const mean = points.reduce((sum, q) => sum.map((v, i) => v + q[i] / points.length), [0, 0]);
  const matrix = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
  for (const q of points) {
    const x = q[0] - mean[0], y = q[1] - mean[1], row = [x, y, 1], value = x * x + y * y;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) matrix[i][j] += row[i] * row[j];
      matrix[i][3] += row[i] * value;
    }
  }
  for (let i = 0; i < 3; i++) {
    const divisor = matrix[i][i];
    for (let j = i; j < 4; j++) matrix[i][j] /= divisor;
    for (let k = 0; k < 3; k++) if (k !== i) {
      const factor = matrix[k][i];
      for (let j = i; j < 4; j++) matrix[k][j] -= factor * matrix[i][j];
    }
  }
  const local = [matrix[0][3] / 2, matrix[1][3] / 2], center = local.map((v, i) => v + mean[i]);
  const radius = Math.sqrt(matrix[2][3] + local[0] ** 2 + local[1] ** 2);
  const residuals = points.map(q => Math.hypot(q[0] - center[0], q[1] - center[1]) - radius);
  return { center, radius, maximumResidual: Math.max(...residuals.map(Math.abs)),
    rmsResidual: Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / points.length), points, residuals };
}
