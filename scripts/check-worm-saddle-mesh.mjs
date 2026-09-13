import fs from 'node:fs';
import * as THREE from 'three';
import {makeWormSaddleGeometry} from '../src/simulation/mujoco-worm-saddle/geometry.js';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {auditClutchSourceSolids} from './lib/weighted-clutch-fit-audit.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {saddleWheelCut} from '../src/simulation/mujoco-worm-saddle/wheel-data.js';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/104-mesh',file=process.env.HOB_FILE??'src/simulation/mujoco-worm-saddle/wheel-data.js';
const sources=freezeStudySources(['scripts/check-worm-saddle-mesh.mjs','src/simulation/mujoco-worm-saddle/geometry.js',
  'src/simulation/mujoco-worm-saddle/profile.js','src/simulation/worm-gear-geometry.js',file],prefix);
const v=makeWormSaddleGeometry(process.env.HOB_FILE?JSON.parse(fs.readFileSync(file)):saddleWheelCut),u=v.root.userData,f=u.profile,rows=[];
try {
  const samples=surfaceTriangles(u.parts.wheel.geometry).flatMap(t=>[t.a,t.b,t.c,t.getMidpoint(new THREE.Vector3()),t.a.clone().lerp(t.b,.5),t.b.clone().lerp(t.c,.5),t.c.clone().lerp(t.a,.5)]);
  let maximumPenetration=0,witness,checked=0;
  const wrap=x=>x-f.pitch*Math.floor(x/f.pitch+.5),tangent=Math.tan(f.pressureAngle);
  for(let k=0;k<=64;k++) {
    const rotation=k*2*Math.PI/64,angle=rotation/f.teeth,c=Math.cos(angle),s=Math.sin(angle);
    for(const p of samples){
      const x=p.x*c-p.y*s,y=p.x*s+p.y*c-f.distance,z=p.z,r=Math.hypot(y,z);
      if(x<f.low||x>f.high||r>=f.wormTip)continue;checked++;
      const a=Math.atan2(y,-z),offset=wrap(x-f.lead*(a-rotation)-f.phase),sign=Math.sign(offset),gap=Math.abs(offset)-f.tipHalfWidth-(f.wormTip-r)*tangent;
      const norm=Math.hypot(1,sign*f.lead*z/(r*r)+tangent*y/r,-sign*f.lead*y/(r*r)+tangent*z/r);
      const penetration=Math.min(-gap/norm,f.wormTip-r);
      if(penetration>maximumPenetration){maximumPenetration=penetration;witness={k,point:[x,y+f.distance,z],r,offset};}
    }
  }
  console.log({analyticWormPenetrationPixels:maximumPenetration*100,witness,checked});
  for(const [rotation,feed] of [[0,0],[Math.PI,0],[Math.PI*2,0],[0,f.pitch],[0,2*f.pitch]]) {
    u.blocks.worm.rotation.x=rotation;u.blocks.carriage.position.x=feed;u.blocks.wheel.position.x=feed;u.blocks.wheel.rotation.z=(feed+f.lead*rotation)/f.pitchRadius;
    v.root.updateMatrixWorld(true);const a=auditClutchSourceSolids(v);rows.push({rotation,feed,...a});
    console.log({rotation,feed,checks:a.checks,issues:a.issues,topology:a.topologyIssues});
  }
  verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,analytic:{maximumPenetration,witness,checked},rows,
    qualification:'Prescribed geometric sweep only. The native ideal gear coupling and its resulting trajectory are validated separately.'},null,2)+'\n',{flag:'wx'});
}finally{disposeObject3D(v.root);}
