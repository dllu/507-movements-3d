import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';

const movement=JSON.parse(readFileSync('src/data/movements.json')).movements[142];
const model=createMovementModel(movement),{blocks:b,geometry:g}=model.root.userData;
try{
 const worm=b.wormThread,wheel=b.wheelRotor.children.find(o=>o.isMesh&&o.geometry.type==='ExtrudeGeometry');
 if(!wheel)throw new Error('Missing wheel tooth mesh');
 const solid=solidSurface(wheel.geometry),points=surfacePoints(worm.geometry),rows=[];
 // One complete wheel revolution includes every tooth and all carriage poses.
 // Test actual helix skin vertices, edge midpoints and triangle centers.
 for(let i=0;i<129;i++){
  const time=g.completePatternPeriod*(i+.317)/129;
  model.update(time);model.root.updateMatrixWorld(true);
  const transform=wheel.matrixWorld.clone().invert().multiply(worm.matrixWorld);
  let inside=0,maximumDepth=0,witness=null;
  for(const p of points){
   const q=p.clone().applyMatrix4(transform);
   if(!solid.inside(q))continue;
   const depth=solid.distance(q);if(depth<=1e-6)continue;
   inside++;
   if(depth>maximumDepth){maximumDepth=depth;witness=q.toArray();}
  }
  rows.push({time,inside,maximumDepth,witness});
 }
 const report={movement:143,status:'legacy-contact-diagnostic',method:'Actual worm tube surface samples tested against the triangulated wheel solid at 129 offset poses across a full wheel revolution. Positive depth proves interference; absence of sampled containment would not prove complete clearance.',sources:['src/simulation/authored-screws.js','src/simulation/primitives.js','scripts/review-sliding-worm-contact.mjs','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')})),summary:{poses:rows.length,samplesPerPose:points.length,interferingPoses:rows.filter(r=>r.inside).length,inside:rows.reduce((s,r)=>s+r.inside,0),maximumDepth:Math.max(...rows.map(r=>r.maximumDepth)),maximumDepthPixels:Math.max(...rows.map(r=>r.maximumDepth))/g.sourceScale},rows};
 writeFileSync('docs/validation/143-legacy-contact.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
}finally{disposeObject3D(model.root);}
