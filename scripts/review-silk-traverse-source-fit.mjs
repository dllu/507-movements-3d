import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import * as THREE from 'three';
import {makeSilkTraverseAssembly} from '../src/simulation/mujoco-silk-tappet/assembly.js';
const m=makeSilkTraverseAssembly(JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/173-tappet.json.gz'))));
try {
 const {parts,geometry:g}=m.root.userData,project=p=>[g.center[0]+p.x/g.scale,g.center[1]-p.y/g.scale];
 const landmarks=[['wrist',parts.wrist.getWorldPosition(new THREE.Vector3()),[159,310]],['wheel center',parts.hub.getWorldPosition(new THREE.Vector3()),[362,187]],['rod end',parts.guideRod.localToWorld(new THREE.Vector3(340*g.scale,0,0)),[499,283]]].map(([name,p,source])=>({name,source,projected:project(p),errorPixels:Math.hypot(...project(p).map((v,i)=>v-source[i]))}));
 const bounds=new THREE.Box3().setFromObject(parts.hub.parent,true);
 const projectedWheelBounds=[...project(new THREE.Vector3(bounds.min.x,bounds.max.y,0)),...project(new THREE.Vector3(bounds.max.x,bounds.min.y,0))];
 const report={movement:173,status:'source-fit-open',landmarks,projectedWheelBounds,approximateSourceWheelBounds:[331,146,393,229],
  limitation:'Wheel silhouette remains undersized. Raster bounds are approximate manual measurements, not an automated contour registration. Native contact dimensions must be revised and requalified with the visible geometry.',
  sources:['scripts/review-silk-traverse-source-fit.mjs','src/simulation/mujoco-silk-tappet/assembly.js','src/simulation/mujoco-silk-tappet/solids.js','public/engravings/mm_173.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/173-source-fit.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{m.dispose();}
