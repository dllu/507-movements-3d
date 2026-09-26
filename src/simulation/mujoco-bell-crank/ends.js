import * as THREE from 'three';
import {LaidRopeGeometry} from '../laid-rope.js';
import {PALETTE,matte,markShadows} from '../primitives.js';

// Brown crops both cords of 126 at the plate edge and draws nothing beyond:
// no grip on the input fall and no guide sheave or weight on the output
// cord. Each cord therefore runs on straight past the crop as a rigid lead
// that moves with its driven or loaded end and ends cleanly out of the
// default view (p60 support policy). The native model's input drive and
// output load act on those ends directly.
export function addBellCrankRopeEnds(visual){
 const u=visual.root.userData,f=u.profile,r=f.cordRadius,bounds=u.cameraFitBounds;
 const inputDir=new THREE.Vector3(...f.inputPath.direction).normalize(),outputDir=new THREE.Vector3(...f.outputDirection).normalize();
 const inputEnd0=new THREE.Vector3(...f.inputEnd),outputEnd0=new THREE.Vector3(...f.outputEnd);
 const ropeMaterial=color=>matte(color,{metalness:.1,roughness:.6});
 const group=new THREE.Group();group.name='ropeEndsBeyondCrop';visual.root.add(group);
 // Input: a rigid lead below the moving end.
 const inputLead=Math.max(.8,(inputEnd0.y-(bounds.min.y-1.35))/Math.max(.3,-inputDir.y));
 const inputRope=new THREE.Mesh(new LaidRopeGeometry(new THREE.LineCurve3(inputDir.clone().multiplyScalar(inputLead),new THREE.Vector3()),32,r,8,false,{travel:inputLead}),ropeMaterial(PALETTE.driver));
 inputRope.name='inputLead';
 // Output: a rigid lead running on along the cord's line past the right crop.
 // The output cord's lay is measured from its bell-crank end.
 const outputLead=Math.max(.7,bounds.max.x+1.25-outputEnd0.x)+1.1,outputCordLength=f.cordLengths.output.reduce((s,v)=>s+v,0);
 const outputRope=new THREE.Mesh(new LaidRopeGeometry(new THREE.LineCurve3(new THREE.Vector3(),outputDir.clone().multiplyScalar(outputLead)),96,r,8,false,{travel:-outputCordLength}),ropeMaterial(PALETTE.driven));
 outputRope.name='outputLead';
 group.add(inputRope,outputRope);
 markShadows(group);
 return(inputEnd,outputEnd)=>{inputRope.position.copy(inputEnd);outputRope.position.copy(outputEnd);};
}
