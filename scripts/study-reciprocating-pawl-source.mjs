import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { circleFit } from './lib/source-circle-fit.mjs';

const file = 'artifacts/reference/brown-075-detail.png', width = 1250, height = 1360;
const decoded = spawnSync('convert', [file, '-depth', '8', 'rgb:-'], { maxBuffer: 8 * 1024 * 1024 });
if (decoded.status !== 0 || decoded.stdout.length !== width * height * 3) throw new Error('Source decode failed');
const readCircle = (center, low, high, angles) => {
  const points = [], missing = [];
  for (const degrees of angles) {
    const angle = degrees * Math.PI / 180;
    let first = null, last = null;
    for (let r = low; r <= high; r += .25) {
      const x = Math.round(center[0] + r * Math.cos(angle)), y = Math.round(center[1] - r * Math.sin(angle));
      const dark = decoded.stdout[3 * (width * y + x)] < 100;
      if (dark && first === null) first = r;
      if (!dark && first !== null) { last = r - .25; break; }
    }
    if (first === null || last === null) { missing.push(degrees); continue; }
    const r = (first + last) / 2;
    points.push([center[0] + r * Math.cos(angle), center[1] - r * Math.sin(angle)]);
  }
  return { ...circleFit(points), missing };
};
const tips = [[620,253],[689,259],[751,272],[817,298],[883,339],[940,399],[993,484],[1016,573],
  [1019,650],[1009,733],[973,804],[940,862],[903,912],[850,951],[800,985],[735,1011],
  [670,1026],[596,1024],[530,1021],[456,1000],[393,973],[346,909],[296,840],[265,775],
  [240,704],[239,636],[247,570],[268,503],[360,350],[433,309],[489,282],[545,261]];
const tipCircle = circleFit(tips);
const wheelFace = readCircle([627,642], 276, 309,
  Array.from({ length: 72 }, (_, i) => i * 5).filter(a => !(a >= 140 && a <= 155) && !(a >= 295 && a <= 310)));
const hub = readCircle([627,642], 29, 45, Array.from({ length: 36 }, (_, i) => i * 10));
const pivots = { movingPawl: [257,406], holdingPawl: [966,294], rodJoint: [790,732] };
const pawls = {
  moving: { outer: [[256,363],[300,325],[350,299],[397,288],[441,291],[479,304],[501,320]],
    inner: [[295,390],[333,354],[377,326],[419,311],[456,307],[483,313],[501,320]] },
  holding: { outer: [[1000,305],[1014,340],[1011,381],[994,420],[977,446],[958,466]],
    inner: [[976,345],[970,375],[961,400],[953,417],[952,444],[948,479]] },
};
const tipAngles = tips.map(([x,y]) => (Math.atan2(x-hub.center[0],hub.center[1]-y)+2*Math.PI)%(2*Math.PI));
const report = { movement: 75, status: 'source-geometry-study', productionChanged: false,
  source: { file, sha256: createHash('sha256').update(await readFile(file)).digest('hex'), width, height },
  wheelFace, hub, tipCircle, tips, tipAngles, pivots, pawls,
  rod: { centerX: 788, top: 732, bottom: 1194, left: 772, right: 802 },
  barAngleFromLongArm: Math.atan2(hub.center[1]-pivots.movingPawl[1],pivots.movingPawl[0]-hub.center[0])-Math.PI,
  toothCount: { visibleTipReadings: tips.length, obscuredRegion: 'Upper-left sector behind the moving pawl pivot and bar.',
    possibleFullCount: 33, accepted: false },
  qualification: 'Manual outer-tip and pawl-contour readings plus dark-stroke circle fits. The 32 marked visible tips leave one occluded interval behind B/D; a full 33-tooth reconstruction is plausible but is not accepted as an exact historical count. Line thickness, irregular spacing and the partly hidden fixed pawl tip require overlay inspection and contact design. The drawing does not specify the sliding accommodation required between rectilinear C and rotating D.' };
await writeFile('artifacts/review/075-source-geometry-study.json', JSON.stringify(report, null, 2)+'\n', { flag:'wx' });
const point = (q, color, label='') => `<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="${color}"/><text x="${q[0]+7}" y="${q[1]-7}" font-size="18" fill="${color}">${label}</text>`;
const circle = (row,color) => `<circle cx="${row.center[0]}" cy="${row.center[1]}" r="${row.radius}" fill="none" stroke="${color}" stroke-width="2"/>`;
const polyline = (points,color) => `<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image xlink:href="data:image/png;base64,${(await readFile(file)).toString('base64')}" width="${width}" height="${height}"/>`
  + circle(wheelFace,'#00ddff') + circle(hub,'#ffff00') + circle(tipCircle,'#66ff44')
  + tips.map((p,i)=>point(p,'#66ff44',i+1)).join('')
  + Object.entries(pivots).map(([n,p])=>point(p,'#ff88ff',n)).join('')
  + Object.values(pawls).flatMap(p=>Object.values(p).map(r=>polyline(r,'#ff5577'))).join('') + '</svg>';
await writeFile('artifacts/review/075-source-readings.svg',svg,{flag:'wx'});
const render = spawnSync('convert',['-background','white','artifacts/review/075-source-readings.svg','artifacts/review/075-source-readings.png']);
if(render.status!==0)throw new Error('Source overlay render failed');
console.log({visibleTips:tips.length,wheelFace:{center:wheelFace.center,radius:wheelFace.radius,rms:wheelFace.rmsResidual,missing:wheelFace.missing},
  hub:{center:hub.center,radius:hub.radius,rms:hub.rmsResidual},tipCircle:{center:tipCircle.center,radius:tipCircle.radius,rms:tipCircle.rmsResidual}});
