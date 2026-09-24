import * as THREE from 'three';
import {boredCylinderGeometry} from './piston-guide-parts.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const rect=(w,h,x=0,y=0)=>poly([[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]]);
const tube=(r,b,l)=>boredCylinderGeometry(r,b,l);
function boredFlat(mesh,bore,depth){const shape=mesh.geometry.parameters.shapes.clone(),hole=new THREE.Path();hole.absarc(0,0,bore,0,Math.PI*2,true);shape.holes.push(hole);replace(mesh,new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:64}).translate(0,0,-depth/2));}
function passageY(mesh,width,depth,holeWidth,holeDepth,height){replace(mesh,plate(clip.difference(rect(width,depth),rect(holeWidth,holeDepth)),-height/2,height/2).rotateX(Math.PI/2));mesh.rotation.set(0,0,0);}
function link(a,b,width,depth,z,material){const delta=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.BoxGeometry(delta.length(),width,depth),material);mesh.position.set((a.x+b.x)/2,(a.y+b.y)/2,z);mesh.rotation.z=Math.atan2(delta.y,delta.x);return mesh;}
export function correctEpicyclicGuide(root){
  const d=root.userData,b=d.blocks,g=d.geometry;
  // A fixed bearing must fit between the flywheel and carrier, rather than
  // occupying both rotating plates. A bored rear web joins it to annulus D.
  replace(b.centralBearing,tube(.1848,.154,.12));b.centralBearing.position.z=-.31;
  replace(b.centralBore,tube(.155,.153,.12));b.centralBore.position.z=-.31;
  const web=new THREE.Mesh(plate(clip.difference(rect(2*g.fixedRingOuterRadius,.12),poly(circle([0,0],.156,64))),-.04,.04),b.centralBearing.material);
  web.position.z=-.31;web.userData.role='fixed-bored-web-joining-annulus-and-main-journal';b.fixedFrame.add(web);b.bearingWeb=web;
  // The side bosses sit just outside the orbit of wheel B's tips (radius
  // 1.75), still seated on the back of annulus D's rim.
  for(const boss of b.sideBearings){replace(boss,new THREE.CylinderGeometry(.21,.21,.42,40));boss.position.z=-.14;boss.position.x=Math.sign(boss.position.x)*1.975;}
  // Keep the carried pin ahead of the fixed rear web, and the wrist pin
  // ahead of the fixed ring teeth at the two piston dead centers.
  replace(b.inputShaft,new THREE.CylinderGeometry(.1512,.1512,.87,40));b.inputShaft.position.z=-.455;
  replace(b.carrierCrankPin,new THREE.CylinderGeometry(.0756,.0756,.59,40));b.carrierCrankPin.position.z=.075;
  replace(b.planetWristPin,new THREE.CylinderGeometry(.105,.105,.54,40));b.planetWristPin.position.z=.415;
  const body=b.planetGearB.userData.rotor.children[0];boredFlat(body,.078,g.planetGearDepth);b.planetGearBody=body;
  const hub=b.planetGearB.userData.rotor.children.find(o=>o.geometry?.type==='CylinderGeometry');replace(hub,tube(hub.geometry.parameters.radiusTop,.078,hub.geometry.parameters.height));b.planetHub=hub;
  replace(b.wristBoss,tube(.21,.108,.25));replace(b.wristRing,tube(.1512,.108,.045).rotateX(Math.PI/2));
  // Extend the engraving's cropped cylinder to contain the complete source
  // stroke as a closed bored barrel (Brown draws no opening) with a real
  // rod gland; the default view crops it below the cover as the plate does.
  const top=-2.835,bottom=g.pistonHeadBottomLocalY-g.pistonStroke/2-.09,inner=.637,outer=.71;
  replace(b.pistonHead,new THREE.CylinderGeometry(.63,.63,g.pistonHeadTopLocalY-g.pistonHeadBottomLocalY,64));
  replace(b.cylinderBody,tube(outer,inner,top-bottom).translate(0,(top+bottom)/2,0));
  b.cylinderBody.position.set(0,0,g.pistonPlaneZ);
  passageY(b.cylinderTop,1.68,1.5,.17,.163,.1575);b.cylinderTop.position.z=g.pistonPlaneZ;
  passageY(b.gland,.42,.40,.1635,.156,.35);b.gland.position.set(0,-2.54,g.pistonPlaneZ);
  replace(b.cylinderBase,new THREE.BoxGeometry(1.47,.1365,1.5));b.cylinderBase.position.set(0,bottom-.06825,g.pistonPlaneZ);
  d.finiteGuideReview={cylinderBottom:bottom,cylinderTop:top,barrelInnerRadius:inner,qualification:'Exact source epicyclic motion; inferred cylinder continuation, depth layering, journal support and running clearances. No pressure/load simulation.'};
}
export function correctSlottedGuide(root){
  const d=root.userData,b=d.blocks,g=d.geometry;
  const shape=b.yokeBody.geometry.parameters.shapes,slot=capsule([g.slotLeftCenterX,0],[g.slotRightCenterX,0],g.slotHalfHeight+.0005,96);
  replace(b.yokeBody,plate(clip.difference(poly(shape.getPoints(48).map(p=>p.toArray())),slot),-g.crossheadDepth/2,g.crossheadDepth/2));
  replace(b.slotOutline,plate(clip.difference(capsule([g.slotLeftCenterX,0],[g.slotRightCenterX,0],g.slotHalfHeight+.019,96),slot),g.crossheadPlaneZ+g.crossheadDepth/2-.002,g.crossheadPlaneZ+g.crossheadDepth/2+.008));
  replace(b.crankshaft,new THREE.CylinderGeometry(.1728,.1728,.98,48));b.crankshaft.position.z=-.14;
  replace(b.bearingHousing,tube(.36,.177,.44));b.bearingHousing.position.z=-.08;
  replace(b.bearingBore,tube(.178,.175,.44));b.bearingBore.position.z=-.08;
  b.bearingBraces=[];
  for(const side of[-1,1])for(const end of[1,-1]){const brace=link(new THREE.Vector2(side*.25,end*.25),new THREE.Vector2(side*(end>0?g.guideInnerX:1.02),end>0?g.guideTopY:-2.46),.08,.08,-.08,b.bearingHousing.material);brace.userData.role='fixed-diagonal-brace-carrying-main-journal';b.fixedFrame.add(brace);b.bearingBraces.push(brace);}
  for(const[side,shoe]of[[-1,b.leftGuideShoe],[1,b.rightGuideShoe]]){
    const[front,rear,web,liner]=shoe.children,outer=g.guideOuterX+.08,inner=g.guideInnerX-.01;
    replace(front,new THREE.BoxGeometry(outer-inner,1.44,.56));front.position.set(side*(outer+inner)/2,-.24,.465);
    replace(rear,new THREE.BoxGeometry(outer-inner,1.44,.11));rear.position.x=side*(outer+inner)/2;
    replace(web,new THREE.BoxGeometry(.06,1.44,.60));web.position.set(side*(g.guideOuterX+.048),-.24,-.005);
    replace(liner,new THREE.BoxGeometry(.045,1.32,.30));liner.position.set(side*(g.guideInnerX-.0245),-.24,-.02);
  }
  for(const[side,face]of[[-1,b.guideFaces[0]],[1,b.guideFaces[1]]]){replace(face,new THREE.BoxGeometry(.02,g.guideTopY-g.guideBottomY,.34));face.position.set(side*(g.guideInnerX+.01),(g.guideTopY+g.guideBottomY)/2,-.02);}
  // The gland was drawn behind the rod and its apparent bore was another solid.
  passageY(b.cylinderTop,.72,.48,.252,.172,.24);b.cylinderTop.position.z=.64;
  passageY(b.cylinderBore,.30,.22,.246,.166,.25);b.cylinderBore.position.set(0,-1.92,.64);
  const glandNeck=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),b.cylinderTop.material);
  passageY(glandNeck,.50,.76,.252,.172,.32);glandNeck.position.set(0,-2.19,.64);
  glandNeck.userData.role='ported-neck-joining-fixed-gland-to-crossbase';b.fixedFrame.add(glandNeck);b.glandNeck=glandNeck;
  const connector=new THREE.Mesh(new THREE.BoxGeometry(.24,.20,.16),b.pistonRod.material);connector.position.set(0,-.60,.64);connector.userData.role='crosshead-to-piston-rod-neck';b.crossheadA.add(connector);b.rodNeck=connector;
  d.finiteGuideReview={slotRunningClearance:.0005,guideRunningClearance:.002,qualification:'Exact source crank/slot motion; finite running allowances, inferred rear braces and rod/gland depth. No bearing loads or friction simulation.'};
}
export function finishPistonGuides(root,update){
  const d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=d.geometry.cyclePeriod;
  root.traverse(o=>{for(const m of[].concat(o.material??[]))m.fog=false;});
  const box=new THREE.Box3();for(let i=0;i<=64;i++){update(d.geometry.cyclePeriod*i/64);root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh||!o.visible||o.userData.cameraFitGuide)return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});}
  d.cameraFitBounds=box.expandByScalar(.04);d.cameraDistanceScale=1.08;update(0);
}
