import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeSpringJumpCam } from '../src/simulation/spring-jump-cam.js';

const model = makeSpringJumpCam(), { parts, geometry: p, motion } = model.root.userData;
model.update(0); model.root.updateMatrixWorld(true);
const pixel = v => [p.shaft[0] + p.scale * v.x, p.shaft[1] - p.scale * v.y];
const sourcePoints = {
  cam: [[1125,440],[1061,435],[989,461],[918,504],[862,566],[835,628],[831,692],[839,756],
    [861,806],[902,852],[955,888],[1010,900],[1061,894],[1106,864],[1130,834],[1131,650],[1130,510]],
  spring: [[44,149],[164,146],[240,164],[325,205],[404,265],[474,319],[541,336],
    [44,174],[167,173],[244,193],[324,245],[408,311],[477,350],[540,359],
    [505,268],[540,266],[574,287],[591,319],[578,349],[543,360],[503,286],[540,289],[563,307],[560,329],[539,337]],
  lever: [[58,352],[240,351],[494,357],[766,358],[972,359],[1003,416],[788,418],[532,414],[265,413],[58,412]],
  wheel: [[1191,533],[1230,578],[1269,664],[1287,733],[1279,808],[1258,870],[1220,928],[1170,976],
    [1120,1014],[1052,1034],[984,1033],[918,1021],[871,995],[822,954],[785,906],[762,858],[739,780],
    [750,710],[766,650],[803,590],[848,542],[899,498]],
};
// Replace rough beam readings with midpoints of the actual dark boundary
// strokes. Clamp hatching and the follower's later scan runs are excluded.
const scans = JSON.parse(await readFile('artifacts/review/064-source-leaf-scan.json','utf8'));
sourcePoints.spring = scans.filter(row=>row.x<=474).flatMap(row=>row.runs.slice(0,2).map(run=>[row.x,(run[0]+run[1])/2]));
sourcePoints.curl = [[495,267],[495,286],[520,261],[520,286.5],[520,336],[520,357.5],
  [541,264],[541,291],[541,334],[541,357.5],[560,273],[560,356],[575,285],[575,345.5],[590,315.5]];
const contours = { cam: motion.cam.points.map(([x,y]) => pixel(new THREE.Vector3(x,y,0))) };
const leaf = parts.leafSpring.geometry.attributes.position, leafCount = p.springSegments + p.springCurlSegments + 1;
contours.spring = [];
for (let i = 0; i < leafCount; i += 1) contours.spring.push(pixel(new THREE.Vector3().fromBufferAttribute(leaf, 2 * i)));
for (let i = leafCount - 1; i >= 0; i -= 1) contours.spring.push(pixel(new THREE.Vector3().fromBufferAttribute(leaf, 2 * i + 1)));
contours.curl = contours.spring;
const lever = parts.followerLever, attr = lever.geometry.attributes.position, unique = new Map();
for (let i = 0; i < attr.count; i += 1) {
  const x = attr.getX(i), y = attr.getY(i);
  const boundaryError = x < 0 ? Math.abs(Math.hypot(x,y)-p.followerHalfWidth)
    : x > p.followerLength ? Math.abs(Math.hypot(x-p.followerLength,y)-p.followerHalfWidth)
      : Math.abs(Math.abs(y)-p.followerHalfWidth);
  if (boundaryError > 1e-6) continue;
  unique.set(`${x},${y}`, new THREE.Vector3(x,y,0));
}
contours.lever = [...unique.values()].sort((a,b) => Math.atan2(a.y,a.x-p.followerLength/2)-Math.atan2(b.y,b.x-p.followerLength/2))
  .map(v => pixel(v.applyMatrix4(lever.matrixWorld)));
const wheel = parts.wormWheel, g = wheel.geometry, w = g.userData, stride = w.circumferenceSteps + 1;
contours.wheel = Array.from({length: w.circumferenceSteps}, (_,i) => pixel(new THREE.Vector3()
  .fromBufferAttribute(g.attributes.position, w.axialSteps * stride + i).applyMatrix4(wheel.matrixWorld)));
const nearest = (q, path) => Math.min(...path.map((a,i) => {
  const b = path[(i+1)%path.length], dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
  const t = den ? Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/den)) : 0;
  return Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy);
}));
const groups = Object.entries(sourcePoints).map(([name, points]) => {
  const rows=points.map(point=>({point,residual:nearest(point,contours[name])}));
  return {name,maximumResidual:Math.max(...rows.map(r=>r.residual)),rmsResidual:Math.sqrt(rows.reduce((s,r)=>s+r.residual**2,0)/rows.length),rows};
});
const centers = [['shaft',[1010,759],new THREE.Vector3()],['followerPivot',[56,383],new THREE.Vector3(...p.followerPivot,0)],
  ['roller',[1070,387],parts.rollerTread.getWorldPosition(new THREE.Vector3())]]
  .map(([name,sourcePoint,point])=>({name,sourcePoint,modelPoint:pixel(point),residual:Math.hypot(...pixel(point).map((v,i)=>v-sourcePoint[i]))}));
const report = {movement:64,source:'../reference/brown-064-detail.png',method:'Independent manually marked visible boundaries and centers in the unchanged Brown enlargement, compared with the actual projected candidate contours at time zero. The wheel marks are an irregular engraving, not an exact tooth-count determination. Depth/perspective and obscured anatomy remain separate review judgments.',groups,centers};
await writeFile('artifacts/review/064-candidate-source-outline.json',JSON.stringify(report,null,2)+'\n');
const background=(await readFile('artifacts/reference/brown-064-detail.png')).toString('base64');
const colors={cam:'#008bff',spring:'#d000ff',curl:'#d000ff',lever:'#ff2700',wheel:'#00c67a'};
const svg=Object.entries(contours).filter(([name])=>name!=='curl').map(([name,path])=>`<polyline points="${[...path,path[0]].map(q=>q.join(',')).join(' ')}" fill="none" stroke="${colors[name]}" stroke-width="2"/>`).join('');
const marks=Object.entries(sourcePoints).flatMap(([name,points])=>points.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="none" stroke="${colors[name]}" stroke-width="1.5"/>`)).join('');
await writeFile('artifacts/review/064-candidate-source-overlay.html',`<!doctype html><meta charset="utf-8"><title>064 candidate source overlay</title><style>body{margin:0;background:#fff}svg{width:1320px;height:1250px}</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1320 1250"><image href="data:image/png;base64,${background}" width="1320" height="1250"/>${svg}${marks}</svg>`);
console.log({groups:groups.map(({name,maximumResidual,rmsResidual})=>({name,maximumResidual,rmsResidual})),centers});
