import * as THREE from 'three';
import {createAuthoredCamMovement} from '../authored-cams.js';
import {variableCamProfile} from './profile.js';
import {matte,PALETTE,markShadows} from '../primitives.js';
/** Offline reconstruction: retain source proportions, replace working surfaces and supports. */
export function makeVariableCamGeometry({samplesPerArc=128}={}){
 const model=createAuthoredCamMovement({id:138}),{root}=model,b=root.userData.blocks,g=root.userData.geometry;
 const remove=name=>b[name].removeFromParent();
 for(const name of ['cameraEnvelope','contactMarker','baseRail','supportPost','shaftBearingArm','lowerGuideArm','upperGuideArm','shaftBearing','carrierRim','shaftKey','camRotationIndex','followerIndex','camOutline'])remove(name);
 const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
 const extrude=(shape,depth)=>{const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:48});geo.translate(0,0,-depth/2);return geo;};
 const shape=new THREE.Shape(variableCamProfile(samplesPerArc).points.map(p=>new THREE.Vector2(...p)));
 replace(b.camPlate,extrude(shape,.34));
 const tip=new THREE.Shape();tip.moveTo(0,0);tip.lineTo(.12,.24);tip.lineTo(-.12,.24);tip.closePath();
 replace(b.followerTip,extrude(tip,.20));b.followerTip.position.z=.09;
 replace(b.followerRod,new THREE.CylinderGeometry(.12,.12,g.followerLength-.24,32));
 b.followerRod.position.set(0,(g.followerLength+.24)/2,.09);
 const annulus=(outer,inner,length)=>{
  const s=new THREE.Shape();s.absarc(0,0,outer,0,2*Math.PI,false);const h=new THREE.Path();h.absarc(0,0,inner,0,2*Math.PI,true);s.holes.push(h);return extrude(s,length);
 };
 for(const name of ['lowerGuideSleeve','upperGuideSleeve']){
  const geo=annulus(.235,.123,g.guideHeight+.08);geo.rotateX(Math.PI/2);replace(b[name],geo);b[name].position.z=.09;
 }
 for(const name of ['lowerGuideBracket','upperGuideBracket'])b[name].position.z=-.20;
 const frameMaterial=matte(PALETTE.frame);
 const post=new THREE.Mesh(new THREE.BoxGeometry(.18,g.upperGuideCenterY-g.shaftCenter.y+.5,.14),frameMaterial);
 post.position.set(0,(g.upperGuideCenterY+g.shaftCenter.y)/2,-.85);root.add(post);
 const bearing=new THREE.Mesh(annulus(.25,.173,.16),frameMaterial);bearing.position.set(0,g.shaftCenter.y,-.70);root.add(bearing);
 for(const y of [g.lowerGuideCenterY,g.upperGuideCenterY]){
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.18,.14,.50),frameMaterial);arm.position.set(0,y,-.57);root.add(arm);
 }
 b.follower.position.set(0,g.shaftCenter.y,0);
 const blocks={cam:b.inputRotor,follower:b.follower};
 root.userData={blocks};markShadows(root);root.traverse(o=>{if(o.material)o.material.fog=false;});root.updateMatrixWorld(true);
 return {root};
}
