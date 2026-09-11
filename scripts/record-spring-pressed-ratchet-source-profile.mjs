import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { makeSourceSpring, makeSourceRatchet, springRatchetSource as source } from './lib/spring-pressed-ratchet-source.mjs';

const prefix = 'artifacts/review/073-refined-source-profile';
const ratchet = makeSourceRatchet(), catchSpring = makeSourceSpring('catch'), strongSpring = makeSourceSpring('strong');
const tip = strongSpring.points.at(-1), rotate = (p,a) => [p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const gapAt = q => ratchet.closest(rotate(tip,-q)).signedDistance - strongSpring.width/2;
const seats = Array.from({length: 241}, (_,i) => ({q:(i-120)/1000, gap:gapAt((i-120)/1000)})), contacts = [];
for (let i=1; i<seats.length; i++) if (seats[i-1].gap*seats[i].gap<=0) {
  let low=seats[i-1].q, high=seats[i].q, first=seats[i-1].gap;
  for (let j=0; j<50; j++) {
    const middle=(low+high)/2, gap=gapAt(middle);
    if (first*gap<=0) high=middle; else { low=middle; first=gap; }
  }
  const q=(low+high)/2, nearest=ratchet.closest(rotate(tip,-q));
  const normal=rotate(nearest.normal,q), point=rotate(nearest.point,q);
  contacts.push({q,gap:gapAt(q),feature:nearest.feature,tooth:nearest.tooth,normal,point,
    torqueOnWheel:-(point[0]*normal[1]-point[1]*normal[0])});
}
const file='scripts/lib/spring-pressed-ratchet-source.mjs';
await writeFile(prefix+'.json',JSON.stringify({movement:73,status:'isolated-source-profile-study',productionChanged:false,
  sourceFile:file,sourceSha256:createHash('sha256').update(await readFile(file)).digest('hex'),
  parameters:{center:source.center,scale:source.scale,toothCount:source.toothCount,driverRadius:source.driverRadius,
    rootRadius:ratchet.rootRadius,pitch:ratchet.pitch,flankRadius:ratchet.radius,flankCenter:ratchet.center,
    tipAngle:ratchet.tipAngle,faceInterval:ratchet.faceInterval,adjustment:ratchet.adjustment},
  springs:{catch:catchSpring,strong:strongSpring},seats,contacts,
  qualification:'Regular source-shaped ten-tooth profile, sampled inextensible spring centerlines and static rounded-tip seating only. The strong spring centerline uses midpoints of the two visible boundary strokes. Its source taper, coupled elastic equilibrium, contact forces during movement, hardware and 3D rendering still require reconstruction and verification.'
},null,2)+'\n',{flag:'wx'});
const path=points=>points.map((p,i)=>`${i?'L':'M'}${source.center[0]+p[0]*source.scale},${source.center[1]-p[1]*source.scale}`).join(' ');
const png=(await readFile('artifacts/reference/brown-073-detail.png')).toString('base64');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1250" height="1170"><image xlink:href="data:image/png;base64,${png}" width="1250" height="1170"/><path d="${path(ratchet.points)} Z" fill="none" stroke="#ff4444" stroke-width="2"/><path d="${path(catchSpring.points)}" fill="none" stroke="#00ffff" stroke-width="3"/><path d="${path(strongSpring.points)}" fill="none" stroke="#44ff44" stroke-width="3"/></svg>`;
await writeFile(prefix+'.svg',svg,{flag:'wx'});
const render=spawnSync('convert',[prefix+'.svg',prefix+'.png']);
if(render.status!==0)throw new Error('Overlay render failed: '+render.stderr);
console.log({toothCount:source.toothCount,catchLength:catchSpring.length,strongLength:strongSpring.length,contacts});
