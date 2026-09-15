import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredIntermittentMovement} from '../src/simulation/authored-intermittent.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const v=createAuthoredIntermittentMovement({id:155}),u=v.root.userData,b=u.blocks;
try{
 const modes=[];
 for(const direction of [1,-1]){
  u.setPawlDirection(direction);let claimedEngaged=0,separatedWhileClaimedEngaged=0,minimumDepthGap=Infinity,maximumDepthGap=0;
  for(let pose=0;pose<=128;pose++){
   v.update(u.geometry.cyclePeriod*pose/128);v.root.updateMatrixWorld(true);
   const wheel=new THREE.Box3().setFromObject(b.wheelBody),pawl=new THREE.Box3().setFromObject(b.pawlBody);
   const gap=Math.max(pawl.min.z-wheel.max.z,wheel.min.z-pawl.max.z,0);
   minimumDepthGap=Math.min(minimumDepthGap,gap);maximumDepthGap=Math.max(maximumDepthGap,gap);
   if(u.contacts.pawlToothFace.engaged){claimedEngaged++;if(gap>1e-5)separatedWhileClaimedEngaged++;}
  }
  modes.push({direction,poses:129,claimedEngaged,separatedWhileClaimedEngaged,minimumDepthGap,maximumDepthGap});
 }
 const report={movement:155,method:'Actual rendered wheel-body and pawl-body world-Z extents over 129 poses in each direction. Separation is sufficient to disprove physical contact regardless of any plan-view calculation. This does not qualify the rest of the assembly.',legacy:{toothCount:u.geometry.toothCount,rootRadiusPixels:u.geometry.sourceWheelRootRadius,tipRadiusPixels:u.geometry.sourceWheelOuterRadius,sourceUpperPivot:u.geometry.sourceUpperPivot.toArray(),mappedUpperPivot:u.geometry.sourceMappedUpperPivot.toArray()},modes,conclusion:'Every claimed engagement is separated in depth. The wheel and pawl angles, lifted return and slot closure are prescribed; contact metadata does not establish contact between the visible solids.',sources:['scripts/review-elbow-pawl-legacy-contact.mjs','src/simulation/authored-intermittent.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/155-legacy-contact.json',JSON.stringify(report,null,2)+'\n');console.log(modes);
}finally{disposeObject3D(v.root);}
