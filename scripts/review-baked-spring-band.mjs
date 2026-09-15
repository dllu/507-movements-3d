import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {makeSpringTreadleModel} from '../src/simulation/baked/spring-treadle.js';
const asset='src/simulation/baked/assets/160.json.gz',bundle=JSON.parse(gunzipSync(fs.readFileSync(asset))),v=makeSpringTreadleModel(bundle);let minimum=Infinity,worstTime=0;
try{
 for(let pose=0;pose<129;pose++){
  const time=4*(pose+.371)/129;v.update(time);const curve=v.root.userData.bandCurve,step=curve.getLength()/1024,points=Array.from({length:1025},(_,i)=>curve.getPointAt(i/1024)),gap=Math.max(1,Math.floor(4*.048/step)-1);let nearest=Infinity;
  for(let a=0;a<points.length;a++)for(let b=a+gap;b<points.length;b++)nearest=Math.min(nearest,points[a].distanceToSquared(points[b]));
  const clearance=Math.sqrt(nearest)-2*step-2*.048;if(clearance<minimum){minimum=clearance;worstTime=time;}
 }
 const report={movement:160,poses:129,segments:1024,minimumNonlocalClearanceLowerBound:minimum,worstTime,method:'Interpolated baked motion at off-keyframe phases. Nonlocal band portions separated by at least four radii: all sampled point pairs, subtract two arclength spacings and two band radii to bound intervening curve clearance. Local line/helix curvature radius exceeds band radius. Sampled-time check, not continuous-time proof.',sources:[asset,'scripts/review-baked-spring-band.mjs','src/simulation/baked/spring-treadle.js','src/simulation/mujoco-spring-return-treadle/kinematics.js','src/simulation/mujoco-spring-return-treadle/band-route.js','src/simulation/axially-separated-band.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/160-baked-band-self-clearance.json',JSON.stringify(report,null,2)+'\n');console.log({minimum,worstTime});assert.ok(minimum>0);
}finally{v.dispose();}
