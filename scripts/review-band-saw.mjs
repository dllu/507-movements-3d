import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3} from 'three';
import {createAuthoredBeltMovement} from '../src/simulation/authored-belts.js';
import {bandSawDimensions as source} from '../src/data/band-saw-dimensions.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const model=createAuthoredBeltMovement({id:141}),{geometry:g,blocks:b}=model.root.userData;
const pixelsPerUnit=(source.lowerWheel[1]-source.upperWheel[1])/g.wheelCenterDistance;
let maximumToothDepth=0,interferingPoses=0,maximumRimRadius=0;
const rim=b.lowerWheel.userData.blocks.rim;
rim.updateMatrix();const vertices=rim.geometry.attributes.position;
for(let i=0;i<vertices.count;i++){
 const p=new Vector3().fromBufferAttribute(vertices,i).applyMatrix4(rim.matrix);maximumRimRadius=Math.max(maximumRimRadius,Math.hypot(p.x,p.y));
}
try{
 for(let i=0;i<64;i++){
  model.update((i+.371)/64*g.sawToothPitch/g.bladeLinearSpeed);model.root.updateMatrixWorld(true);let depthAtPose=0;
  for(const tooth of b.sawTeeth){
   const positions=tooth.geometry.attributes.position;
   for(let j=0;j<positions.count;j++){
    const p=tooth.localToWorld(new Vector3().fromBufferAttribute(positions,j));
    for(const center of [g.lowerWheelCenter,g.upperWheelCenter]){
     const radius=Math.hypot(p.x-center.x,p.y-center.y);
     // Strictly inside the un-beveled annulus and its axial working width.
     // Ignoring the bevel understates the interference.
     const depth=Math.min(g.wheelContactRadius-radius,radius-(g.wheelContactRadius-.105),g.wheelWidth/2-Math.abs(p.z));
     depthAtPose=Math.max(depthAtPose,depth);
    }
   }
  }
  maximumToothDepth=Math.max(maximumToothDepth,depthAtPose);if(depthAtPose>1e-8)interferingPoses++;
 }
 const pixel=([x,y])=>[315+x*pixelsPerUnit,400-y*pixelsPerUnit];
 const report={registration:'Both wheel centres matched to engraving; uniform scale, no perspective.',pixelsPerUnit,legacyWheelPitchRadiusPixels:g.wheelPitchRadius*pixelsPerUnit,measuredWheelRadiusPixels:source.wheelRadius,legacyTable:{left:pixel([g.tableLeftX,0])[0],right:pixel([g.tableRightX,0])[0],top:pixel([0,g.tableTopY])[1]},measuredTable:source.table,contact:{samples:64,interferingPoses,maximumToothVertexDepth:maximumToothDepth,maximumToothVertexDepthPixels:maximumToothDepth*pixelsPerUnit,actualMaximumRimRadius:maximumRimRadius,bladeInnerRadius:g.wheelContactRadius,rimRadialExcess:maximumRimRadius-g.wheelContactRadius,wheelFront:g.wheelWidth/2,toothRootZ:g.bladeWidth/2},caveat:'Finite tooth vertices inside the nominal wheel annulus prove interference; this is not an exhaustive triangle collision audit. The rim also exceeds the nominal blade inner radius. Browser geometry remains unchanged pending reconstruction.',sources:['src/simulation/authored-belts.js','src/data/band-saw-dimensions.js','scripts/review-band-saw.mjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/141-review.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{disposeObject3D(model.root);}
