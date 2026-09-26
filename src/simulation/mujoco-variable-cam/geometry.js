import * as THREE from 'three';
import {createAuthoredCamMovement} from '../authored-cams.js';
import {variableCamProfile} from './profile.js';
import {markShadows} from '../primitives.js';
/** Offline reconstruction: retain source proportions, replace working surfaces and supports. */
export function makeVariableCamGeometry({samplesPerArc=128}={}){
 const model=createAuthoredCamMovement({id:138}),{root}=model,b=root.userData.blocks,g=root.userData.geometry;
 // Engraving registration: shaft (259,381), guide centres y=180/69,
 // guide width/height 67/22 px, and 309 px from follower point to rod end.
 g.followerLength=309/51.25;g.guideHeight=22/51.25;g.guideWidth=67/51.25;
 g.lowerGuideCenterY=-.45+201/51.25;g.upperGuideCenterY=-.45+312/51.25;
 // Parts already retired upstream (e.g. the dark cam outline) may be absent.
 const remove=name=>b[name]?.removeFromParent();
 for(const name of ['cameraEnvelope','contactMarker','baseRail','supportPost','shaftBearingArm','lowerGuideArm','upperGuideArm','shaftBearing','carrierRim','shaftKey','camRotationIndex','followerIndex','camOutline'])remove(name);
 const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
 for(const side of ['lower','upper']){
  b[side+'Guide'].position.y=g[side+'GuideCenterY'];
  replace(b[side+'GuideBracket'],new THREE.BoxGeometry(g.guideWidth,g.guideHeight,.3));
  b[side+'GuideBolts'].forEach((bolt,i)=>bolt.position.x=(i===0?-1:1)*21/51.25);
 }
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
  const geo=annulus(.235,.123,g.guideHeight+.08);geo.rotateX(Math.PI/2);replace(b[name],geo);b[name].rotation.set(0,0,0);b[name].position.z=.09;
 }
 for(const name of ['lowerGuideBracket','upperGuideBracket'])b[name].position.z=-.20;
 // Brown draws only the two bolted guide brackets: no post, arms or shaft
 // bearing behind the disc (p60 support policy), so the brackets stand free
 // and the shaft ends as a plain stub.
 b.carrierDisk.name='carrierDisk';b.outerHub.name='outerHub';
 b.follower.position.set(0,g.shaftCenter.y,0);
 const blocks={cam:b.inputRotor,follower:b.follower};
 root.userData={blocks};markShadows(root);root.traverse(o=>{if(o.material)o.material.fog=false;});root.updateMatrixWorld(true);
 return {root};
}
