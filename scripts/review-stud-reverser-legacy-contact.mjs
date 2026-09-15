import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createAuthoredStudDriveMovement} from '../src/simulation/authored-stud-drives.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const v=createAuthoredStudDriveMovement({id:153}),u=v.root.userData,b=u.blocks;
try{
 const pins=b.pinAssemblies.map(p=>p.userData.blocks.pin),arms=b.inputArm.children;
 const data=new Map([...pins,...arms].map(mesh=>[mesh,{points:surfacePoints(mesh.geometry),solid:solidSurface(mesh.geometry)}]));
 let checks=0,maxDepth=0,witness=null,failedPoses=0;
 for(let pose=0;pose<=240;pose++){
  const time=u.geometry.strokePeriod*pose/240;v.update(time);v.root.updateMatrixWorld(true);let failed=false;
  for(const pin of pins)for(const arm of arms)for(const [from,to] of [[pin,arm],[arm,pin]]){
   const matrix=to.matrixWorld.clone().invert().multiply(from.matrixWorld);
   for(const p of data.get(from).points){checks++;const q=p.clone().applyMatrix4(matrix);if(!data.get(to).solid.inside(q))continue;const depth=data.get(to).solid.distance(q);if(depth>1e-5)failed=true;if(depth>maxDepth){maxDepth=depth;witness={time,stage:u.kinematics.stage,depth};}}
  }
  if(failed)failedPoses++;
 }
 const report={movement:153,method:'Bidirectional actual pin and input-arm vertices, edge midpoints and triangle centers through 241 prescribed half-cycle poses. This checks the old production animation, independently of native physics assumptions.',summary:{poses:241,checks,failedPoses,maxDepth,witness},sources:['scripts/review-stud-reverser-legacy-contact.mjs','src/simulation/authored-stud-drives.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/153-legacy-contact.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
}finally{disposeObject3D(v.root);}
