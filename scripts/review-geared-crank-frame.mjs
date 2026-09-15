import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeGearedCrankFrame} from '../src/simulation/geared-crank-frame.js';
import {gearedCrankLengths as lengths} from '../src/simulation/geared-crank-source.js';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
const v=makeGearedCrankFrame();
try{
 const mesh=v.root.userData.parts['oblong-rocking-frame'],solid=solidSurface(mesh.geometry);
 let minimumShaftClearance=Infinity,minimumJointClearance=Infinity,minimumClosureHeight=Infinity,failingShaftPoses=0;
 for(let i=0;i<=256;i++){
  const s=v.update(i*8/256),inverse=mesh.matrixWorld.clone().invert();let shaftClearance=Infinity;
  minimumClosureHeight=Math.min(minimumClosureHeight,s.closureHeight);
  for(let j=0;j<96;j++){
   const a=2*Math.PI*j/96;
   shaftClearance=Math.min(shaftClearance,solid.signedDistance(new THREE.Vector3(.2*Math.cos(a),.2*Math.sin(a),.475).applyMatrix4(inverse)));
   minimumJointClearance=Math.min(minimumJointClearance,solid.signedDistance(new THREE.Vector3(s.joint.x+.12*Math.cos(a),s.joint.y+.12*Math.sin(a),.475).applyMatrix4(inverse)));
  }
  minimumShaftClearance=Math.min(minimumShaftClearance,shaftClearance);if(shaftClearance<0)failingShaftPoses++;
 }
 const report={movement:148,status:'through-shaft-arrangement-rejected',interpretation:'Test a hypothetical gear shaft extending through the oblong frame plane. It collides; the separate assembly candidate instead terminates a rear-supported shaft behind that plane. The oblong is interpreted as a structural part of the long rocker, and the upper joint is shifted 14px right. Neither detail is a verified reading of the engraving.',
  summary:{poses:257,lengths,minimumClosureHeight,minimumShaftClearance,minimumJointClearance,failingShaftPoses},
  sources:['scripts/review-geared-crank-frame.mjs','src/simulation/geared-crank-source.js','src/simulation/geared-crank-frame.js','tests/helpers/solid-surface.mjs','src/simulation/finite-plate-geometry.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/148-rocking-frame.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
}finally{v.dispose();}
