import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredEngineReverserMovement} from '../src/simulation/authored-engine-reversers.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const model=createAuthoredEngineReverserMovement({id:179}),u=model.root.userData,b=u.blocks;
try{
 model.update(0);model.root.updateMatrixWorld(true);
 const project=v=>u.modelPointToSourceRaster(new THREE.Vector2(v.x,v.y));
 const extent=mesh=>{
  const bounds=[Infinity,Infinity,-Infinity,-Infinity],p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const q=project(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)));
   bounds[0]=Math.min(bounds[0],q.x);bounds[1]=Math.min(bounds[1],q.y);
   bounds[2]=Math.max(bounds[2],q.x);bounds[3]=Math.max(bounds[3],q.y);}
  return bounds;
 };
 const features=[['lifting grip',b.liftingHandleGrip,[73,193,96,203]],['gab',b.gabBridge,[162,271,198,298]],
  ['strap',b.strapBody,[345,213,498,366]],['eccentric disk',b.eccentricDisk,[371,234,483,346]]]
  .map(([name,mesh,expected])=>{const actual=extent(mesh);return{name,actual,expected,maximumErrorPixels:Math.max(...actual.map((v,i)=>Math.abs(v-expected[i])))};});
 const sourceHandleTip=project(b.liftingHandleGrip.getWorldPosition(new THREE.Vector3()));
 const report={movement:179,status:'source-fit-open',method:'Initial front projection. Manually selected raster bounds include hand-drawn perspective; this diagnostic does not assume all source circles are exactly concentric.',features,sourceHandleTip:sourceHandleTip.toArray(),sources:['scripts/review-engine-reverser-source.mjs','src/simulation/authored-engine-reversers.js','public/engravings/mm_179.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/179-source-fit.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{disposeObject3D(model.root);}
