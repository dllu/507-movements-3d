import * as THREE from 'three';
import {LaidRopeGeometry,replaceWithLaidRope} from '../laid-rope.js';
import {makeHaulingHand} from '../hauling-hand.js';
import {PALETTE,matte,markShadows} from '../primitives.js';

// Brown crops both cords of 126 at the plate edge. Beyond the crop the input
// fall runs down to plate 12's hauling hand (the driven input end) and the
// output cord runs over a small guide sheave to the hanging weight that
// supplies the native model's output load. Nothing is added inside the
// default view: the camera keeps the authored plate bounds.
export function addBellCrankRopeEnds(visual){
 const u=visual.root.userData,f=u.profile,r=f.cordRadius,bounds=u.cameraFitBounds;
 const inputDir=new THREE.Vector3(...f.inputPath.direction).normalize(),outputDir=new THREE.Vector3(...f.outputDirection).normalize();
 const inputEnd0=new THREE.Vector3(...f.inputEnd),outputEnd0=new THREE.Vector3(...f.outputEnd);
 const ropeMaterial=color=>matte(color,{metalness:.1,roughness:.6}),frame=matte(PALETTE.frame,{metalness:.14,roughness:.66}),ink=matte(PALETTE.ink,{metalness:.2,roughness:.5});
 const group=new THREE.Group();group.name='ropeEndsBeyondCrop';visual.root.add(group);
 // Input: a rigid lead below the moving end, gripped by the hand.
 const inputLead=Math.max(.8,(inputEnd0.y-(bounds.min.y-1.35))/Math.max(.3,-inputDir.y));
 const inputRope=new THREE.Mesh(new LaidRopeGeometry(new THREE.LineCurve3(inputDir.clone().multiplyScalar(inputLead),new THREE.Vector3()),32,r,8,false,{travel:inputLead}),ropeMaterial(PALETTE.driver));
 inputRope.name='inputLead';
 const hand=makeHaulingHand(inputDir.clone().negate(),r/.8);hand.scale.setScalar(.8);hand.name='inputHand';
 group.add(inputRope,hand);
 // Output: over a guide sheave beyond the right crop and down to a weight.
 const sheaveRadius=.24,up=new THREE.Vector3(-outputDir.y,outputDir.x,0);
 const top=outputEnd0.clone().addScaledVector(outputDir,Math.max(.7,bounds.max.x+1.25-outputEnd0.x));
 const center=top.clone().addScaledVector(up,-sheaveRadius);
 const startAngle=Math.atan2(up.y,up.x),hang0=1.1;
 const sheave=new THREE.Group();sheave.name='outputGuideSheave';sheave.position.copy(center);
 const lathe=new THREE.LatheGeometry([[.07,-.1],[sheaveRadius+.05,-.1],[sheaveRadius+.05,-.07],[sheaveRadius-r,-.035],[sheaveRadius-r,.035],[sheaveRadius+.05,.07],[sheaveRadius+.05,.1],[.07,.1]].map(([x,y])=>new THREE.Vector2(x,y)),48);
 lathe.rotateX(Math.PI/2);
 const wheel=new THREE.Mesh(lathe,frame);wheel.name='outputGuideSheaveWheel';
 const pin=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.34,24).rotateX(Math.PI/2),ink);pin.name='outputGuideSheavePin';
 // A strap hangs the sheave pin from a short beam behind the cord plane.
 const strap=new THREE.Mesh(new THREE.BoxGeometry(.12,.72,.04),frame);strap.position.set(0,.36,-.15);strap.name='outputGuideSheaveStrap';
 const beam=new THREE.Mesh(new THREE.BoxGeometry(.9,.14,.34),frame);beam.position.set(0,.72+.07,-.1);beam.name='outputGuideSheaveBeam';
 sheave.add(wheel,pin,strap,beam);
 const weight=new THREE.Group();weight.name='outputLoadWeight';
 const body=new THREE.Mesh(new THREE.CylinderGeometry(.26,.32,.46,28),ropeMaterial(PALETTE.driven));body.position.y=-.36;
 const eye=new THREE.Mesh(new THREE.TorusGeometry(.09,.028,8,22),ink);eye.rotation.y=Math.PI/2;eye.position.y=-.04;
 weight.add(body,eye);
 const outputPath=end=>{
  const shift=end.clone().sub(outputEnd0).dot(outputDir),curve=new THREE.CurvePath();
  curve.add(new THREE.LineCurve3(end.clone(),top.clone()));
  const arc=new THREE.Curve();arc.getPoint=(t,target=new THREE.Vector3())=>{const a=startAngle-t*startAngle;return target.set(center.x+sheaveRadius*Math.cos(a),center.y+sheaveRadius*Math.sin(a),center.z);};
  curve.add(arc);
  const side=new THREE.Vector3(center.x+sheaveRadius,center.y,center.z);
  curve.add(new THREE.LineCurve3(side,side.clone().add(new THREE.Vector3(0,-(hang0+shift),0))));
  return curve;
 };
 const outputRope=new THREE.Mesh(new LaidRopeGeometry(outputPath(outputEnd0),96,r,8,false),ropeMaterial(PALETTE.driven));outputRope.name='outputLead';
 group.add(outputRope,sheave,weight);
 markShadows(group);
 const outputCordLength=f.cordLengths.output.reduce((s,v)=>s+v,0);
 return(inputEnd,outputEnd)=>{
  inputRope.position.copy(inputEnd);
  hand.position.copy(inputEnd).addScaledVector(inputDir,inputLead);
  const path=outputPath(outputEnd);
  // The output cord's lay is measured from its bell-crank end.
  replaceWithLaidRope(outputRope,path,{radius:r,tubularSegments:96,travel:-outputCordLength});
  weight.position.copy(path.getPoint(1));
  // The sheave turns with the cord running over it.
  wheel.rotation.z=-outputEnd.clone().sub(outputEnd0).dot(outputDir)/sheaveRadius;
 };
}
