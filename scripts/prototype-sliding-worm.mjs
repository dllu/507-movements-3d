import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {generateWormWheelProfile} from '../src/simulation/worm-wheel-profile.js';
import {cylindricalWormGeometry,wormWheelGeometry} from '../src/simulation/worm-gear-geometry.js';
import {solidSurface,surfacePoints,surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {triangleTree,meshPairDistance} from './lib/star-mangle-pair-distance.mjs';

// Isolated mating-surface candidate, not an accepted complete assembly.
// A 56 px outside radius at the existing .015 scale gives module .07.
// Preserve the engraving's 65.25 px shaft-to-wheel center distance.
const parameters={teeth:22,pitchRadius:.77,wormPitchRadius:.20875,wormLength:4*Math.PI*.07,depth:.3,pressureAngle:Math.PI/9};
const options={angularSteps:256,axialSteps:32,phaseSteps:1600,radialSteps:80,clearance:.0006};
const profile=generateWormWheelProfile(parameters,options);
writeFileSync('/dev/shm/143-worm-candidate-profile.json',JSON.stringify({parameters,profile}));
const worm=new THREE.Mesh(cylindricalWormGeometry({pitchRadius:parameters.wormPitchRadius,module:.07,length:parameters.wormLength,pressureAngle:parameters.pressureAngle,angularSteps:640}));
worm.geometry.rotateY(Math.PI/2);worm.position.y=parameters.pitchRadius+parameters.wormPitchRadius;
const wheel=new THREE.Mesh(wormWheelGeometry(parameters,{profile}));
const solids=[worm,wheel].map(mesh=>({mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
const wormTree=triangleTree(worm.geometry);
const workingFaces=surfaceTriangles(wheel.geometry).filter(face=>{
 const q=face.getMidpoint(new THREE.Vector3()),normal=face.getNormal(new THREE.Vector3());
 return -q.clone().cross(normal).z>Math.hypot(q.x,q.y)*.1;
});
const workingGeometry=new THREE.BufferGeometry().setFromPoints(workingFaces.flatMap(f=>[f.a,f.b,f.c]));
const workingTree=triangleTree(workingGeometry);
const rows=[];
for(let i=0;i<33;i++){
 const input=2*Math.PI*(i+.317)/33;
 worm.rotation.x=input-Math.PI/2;wheel.rotation.z=Math.PI/2+input/parameters.teeth;
 worm.updateMatrixWorld(true);wheel.updateMatrixWorld(true);
 let inside=0,maximumDepth=0;
 for(const [from,to] of [[solids[0],solids[1]],[solids[1],solids[0]]]){
  const matrix=to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
  for(const p of from.points){const q=p.clone().applyMatrix4(matrix);if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<=1e-6)continue;inside++;maximumDepth=Math.max(maximumDepth,depth);}
 }
 const transform=wheel.matrixWorld.clone().invert().multiply(worm.matrixWorld);
 const contact=meshPairDistance(wormTree,workingTree,transform,.02);
 let outputTorque=null,powerResidual=null;
 if(contact.witness&&contact.distance>1e-10){
  const a=new THREE.Vector3().fromArray(contact.witness.a).applyMatrix4(wheel.matrixWorld);
  const b=new THREE.Vector3().fromArray(contact.witness.b).applyMatrix4(wheel.matrixWorld);
  const force=b.clone().sub(a).normalize();
  outputTorque=b.clone().cross(force).z;
  const inputTorque=a.clone().sub(worm.position).cross(force.clone().negate()).x;
  powerResidual=Math.abs(inputTorque+outputTorque/parameters.teeth)/Math.max(Math.abs(inputTorque),Math.abs(outputTorque/parameters.teeth));
 }
 rows.push({input,inside,maximumDepth,gap:contact.distance,outputTorque,powerResidual});
 if(i%8===0)console.log(rows.at(-1));
}
const report={movement:143,status:'isolated-generated-surface-candidate',parameters,options,sources:['scripts/prototype-sliding-worm.mjs','src/simulation/worm-wheel-profile.js','src/simulation/worm-gear-geometry.js','tests/helpers/solid-surface.mjs','scripts/lib/star-mangle-pair-distance.mjs'].map(file=>({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')})),summary:{poses:rows.length,inside:rows.reduce((s,r)=>s+r.inside,0),maximumDepth:Math.max(...rows.map(r=>r.maximumDepth)),minimumGap:Math.min(...rows.map(r=>r.gap)),maximumGap:Math.max(...rows.map(r=>r.gap)),minimumOutputTorque:Math.min(...rows.map(r=>r.outputTorque??-Infinity)),maximumPowerResidual:Math.max(...rows.map(r=>r.powerResidual??Infinity)),wheelRoot:wheel.geometry.userData.rootRadius,wormRoot:worm.geometry.userData.rootRadius},limitations:'Isolated surfaces only. Includes sampled containment and nearest working-flank triangle separation with normalized normal-force power residual. Further refinement, source fitting and actual shaft/key bores remain to be checked; not installed in the runtime model.',rows};
writeFileSync('docs/validation/143-generated-contact.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
worm.geometry.dispose();wheel.geometry.dispose();workingGeometry.dispose();
