import fs from 'node:fs';
import * as THREE from 'three';
import {makeOpposedScrewNuts} from '../src/simulation/opposed-screw-nuts.js';
import {makeWormSaddleProfile} from '../src/simulation/mujoco-worm-saddle/profile.js';
import {surfacePoints} from '../tests/helpers/solid-surface.mjs';
const model=makeOpposedScrewNuts(),f=makeWormSaddleProfile(),mesh=model.root.userData.parts.wheel;
try{
 const samples=surfacePoints(mesh.geometry),matrix=new THREE.Matrix4(),points=[];
 for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);for(const p of samples)points.push(p.clone().applyMatrix4(matrix));}
 const results=[],wrap=x=>x-f.pitch*Math.floor(x/f.pitch+.5),tangent=Math.tan(f.pressureAngle);
 for(let phase=0;phase<32;phase++){
  const offset=phase*f.pitch/f.pitchRadius/32;let maxDepth=0,checks=0;
  for(let pose=0;pose<17;pose++){
   const input=2*Math.PI*(pose+.37)/17,angle=mesh.rotation.z+input/18+offset,c=Math.cos(angle),s=Math.sin(angle);
   for(const p of points){const x=p.x*c-p.y*s,y=p.x*s+p.y*c-f.distance,z=p.z,r=Math.hypot(y,z);
    if(Math.abs(x)>.45/model.root.userData.geometry.wormScale||r>=f.wormTip)continue;checks++;
    const a=Math.atan2(y,-z),u=wrap(x-f.lead*(a-input)-f.phase),gap=Math.abs(u)-f.tipHalfWidth-(f.wormTip-r)*tangent;
    const depth=Math.min(-gap/Math.sqrt(1+tangent*tangent+(f.lead/r)**2),f.wormTip-r);maxDepth=Math.max(maxDepth,depth);
   }
  }
  results.push({phase,offset,maxDepth,checks});
 }
 results.sort((a,b)=>a.maxDepth-b.maxDepth);console.log(results.slice(0,8));fs.writeFileSync('/dev/shm/151-phase.json',JSON.stringify(results,null,2));
}finally{model.dispose();}
