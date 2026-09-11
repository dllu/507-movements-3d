import { writeFile } from 'node:fs/promises';

// Manual readings from brown-068-detail.png; the tooth relief is excluded
// from the driver circle, and only hollow endpoints define the output tips.
const driver = [[332,245],[430,261],[499,283],[614,418],[650,493],[658,575],
  [641,677],[605,765],[545,833],[452,878],[351,896],[246,883],[146,836],
  [71,761],[24,660],[18,490],[54,395],[124,322],[217,268]];
const output = [[987,226],[1044,237],[1168,277],[1216,325],[1298,428],[1316,497],
  [1314,653],[1291,711],[1215,810],[1157,863],[1017,905],[949,901],
  [818,856],[765,811],[686,704],[654,643],[655,496],[664,432],[762,303],[817,266]];
const roots = [[1016,280],[1175,337],[1260,484],[1254,672],[1140,829],
  [983,863],[813,807],[707,670],[693,463],[806,331]];

function circleFit(points) {
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
const driverFit = circleFit(driver), outputFit = circleFit(output), rootFit = circleFit(roots);
const centerDistance = Math.hypot(...outputFit.center.map((v, i) => v - driverFit.center[i]));
const report = { movement: 68, status: 'initial-source-layout-study', productionChanged: false,
  source: '../reference/brown-068-detail.png', driverFit, outputFit, rootFit, centerDistance,
  ratio: { outputTipsToDriver: outputFit.radius / driverFit.radius, centersToDriver: centerDistance / driverFit.radius },
  toothTipReading: [578,329],
  qualification: 'Independent manual circle/endpoint readings. The printed circles are irregular; fitted output tips and notch roots are only layout estimates, not a physical tooth profile. This study supplies proportions for future candidates and does not certify an assembled mechanism.' };
await writeFile('artifacts/review/068-source-layout-study.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log({ driver: { center: driverFit.center, radius: driverFit.radius, rms: driverFit.rmsResidual },
  output: { center: outputFit.center, radius: outputFit.radius, rms: outputFit.rmsResidual },
  root: { center: rootFit.center, radius: rootFit.radius, rms: rootFit.rmsResidual }, centerDistance, ratio: report.ratio });
