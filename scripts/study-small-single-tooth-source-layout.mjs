import {readFile,writeFile} from 'node:fs/promises';
const radial=JSON.parse(await readFile('artifacts/review/069-source-radial-study.json','utf8'));
// Manually marked mid-stroke points on the circular portion of B; the tooth and its relief are excluded.
const driver=[[942,535],[917,529],[884,532],[855,544],[833,563],[818,589],[812,619],[816,652],[832,679],[858,701],[887,714],[918,716],[948,708],[974,692],[991,674]];
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
const driverFit=circleFit(driver),outputFit=circleFit(radial.peaks.map(p=>p.point));
const centerDistance=Math.hypot(outputFit.center[0]-driverFit.center[0],outputFit.center[1]-driverFit.center[1]);
const result={movement:69,status:'source-layout-study',productionChanged:false,source:'../reference/brown-069-detail.png',driverFit,outputFit,centerDistance,centerlineAngle:Math.atan2(outputFit.center[1]-driverFit.center[1],driverFit.center[0]-outputFit.center[0]),toothCount:30,toothCountInspection:radial.countInspection,ratio:{outputTipsToDriver:outputFit.radius/driverFit.radius,centersToDriver:centerDistance/driverFit.radius},toothOutlineReadings:[[956,549],[954,587],[1036,550],[1046,570],[970,623],[997,652]],qualification:'Driver points are manual readings of the circular stroke. Output readings are smoothed inner dark-pixel crossings near the thirty tip peaks; line width and smoothing bias their fitted radius inward. This supplies approximate layout and an inspected tooth count, not a mechanical profile or exact registration.'};
await writeFile('artifacts/review/069-source-layout-study.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({driver:{center:driverFit.center,radius:driverFit.radius,rms:driverFit.rmsResidual},output:{center:outputFit.center,radius:outputFit.radius,rms:outputFit.rmsResidual},centerDistance,centerlineDegrees:result.centerlineAngle*180/Math.PI,ratio:result.ratio});
