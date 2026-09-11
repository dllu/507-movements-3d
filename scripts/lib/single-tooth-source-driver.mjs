import * as THREE from 'three';

export const singleToothSource = { anchor: [334.88275264756544, 571.80131572294],
  scale: 326.46087754169275 / 1.36, sourceAngle: Math.PI / 4,
  toothReadings: [[614,418],[598,387],[563,400],[543,393],[560,362],[583,334],
    [576,325],[562,328],[533,341],[500,358],[509,304],[499,283]] };

export function makeSingleToothSourceDriver({ circleSteps = 2048, curveSteps = 64, upperReliefExtension = 0,
  clipReliefToRim = false, upperReliefMode = 'endpoint' } = {}) {
  const { anchor, scale, sourceAngle } = singleToothSource;
  const point = ([x, y]) => new THREE.Vector2((x - anchor[0]) / scale, (anchor[1] - y) / scale);
  const lower = point([614,418]).normalize().multiplyScalar(1.36);
  const upper = point([499,283]).normalize().multiplyScalar(1.36)
    .rotateAround(new THREE.Vector2(), upperReliefMode === 'endpoint' ? upperReliefExtension : 0);
  const path = new THREE.CurvePath(); let current = lower;
  const curves = [
    [[608,406],[606,386],[598,387]], [[573,394],[538,406],[543,396]],
    [[547,374],[574,345],[582,335]], [[586,331],[579,322],[575,325]],
    [[562,326],[524,349],[503,358]], [[499,361],[506,329],[509,304]],
  ];
  for (const row of curves) {
    const [a,b,end] = row.map(point); path.add(new THREE.CubicBezierCurve(current,a,b,end)); current=end;
  }
  path.add(new THREE.CubicBezierCurve(current,point([511,293]),point([506,289]),upper));
  const ring = path.curves.flatMap((curve, index) => curve.getPoints(curveSteps).map((q,j) => {
    if (upperReliefMode === 'distributed' && index > 4) q.rotateAround(new THREE.Vector2(),
      upperReliefExtension * (index - 5 + j / curveSteps) / 2);
    return clipReliefToRim && (index < 2 || index > 4) && q.length() > 1.36 ? q.setLength(1.36) : q;
  }).slice(index ? 1 : 0));
  const start = Math.atan2(upper.y,upper.x) + (upperReliefMode === 'distributed' ? upperReliefExtension : 0);
  const end = Math.atan2(lower.y,lower.x) + Math.PI * 2;
  for(let i=1;i<circleSteps;i++) {
    const a=start+(end-start)*i/circleSteps;ring.push(new THREE.Vector2(1.36*Math.cos(a),1.36*Math.sin(a)));
  }
  return [ring.map(q => [q.x*Math.cos(sourceAngle)+q.y*Math.sin(sourceAngle),
    -q.x*Math.sin(sourceAngle)+q.y*Math.cos(sourceAngle)])];
}
