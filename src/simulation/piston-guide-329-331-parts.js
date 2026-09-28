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
  const hub=b.planetGearB.userData.rotor.children.find(o=>o.geometry?.type==='CylinderGeometry');// The hub's bore stands just clear of the wheel web's own .078 bore so the
  // two bored faces do not coincide.
  replace(hub,tube(hub.geometry.parameters.radiusTop,.0795,hub.geometry.parameters.height));b.planetHub=hub;
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
  replace(b.crankshaft,new THREE.CylinderGeometry(.1728,.1728,.98,48));b.crankshaft.position.z=-.14;
  replace(b.bearingHousing,tube(.36,.177,.44));b.bearingHousing.position.z=-.08;
  replace(b.bearingBore,tube(.178,.175,.44));b.bearingBore.position.z=-.08;
  b.bearingBraces=[];
  for(const side of[-1,1])for(const end of[1,-1]){const brace=link(new THREE.Vector2(side*.25,end*.25),new THREE.Vector2(side*(end>0?g.guideInnerX:1.02),end>0?g.guideTopY:-2.46),.08,.08,-.08,b.bearingHousing.material);brace.userData.role='fixed-diagonal-brace-carrying-main-journal';b.fixedFrame.add(brace);b.bearingBraces.push(brace);}
  // Each shoe is one C-section extrusion running along the pillar: an inner
  // web bearing on the pillar's planed inner face and two flanges lapping
  // its front and rear faces, with the front flange running up into the yoke
  // end. It is open outward, so nothing shows beyond the yoke in front, and
  // it spans the yoke end's own height, just inside its faces.
  const pillarFront=g.frameFrontZ,pillarBack=g.frameBackZ,cl=g.guideRunningClearance??.002;
  const webInner=g.guideInnerX-.07,webFace=g.guideInnerX-cl,flangeEnd=g.guideInnerX+.105;
  const section=clip.difference(rect(flangeEnd-webInner,g.crossheadPlaneZ-(pillarBack-.08),(flangeEnd+webInner)/2,(g.crossheadPlaneZ+pillarBack-.08)/2),
    rect(1,pillarFront-pillarBack+2*cl,webFace+.5,(pillarFront+pillarBack)/2));
  const yokeTop=2*g.sourceScale-.01,yokeBottom=-4*g.sourceScale+.01;
  for(const[side,shoe]of[[-1,b.leftGuideShoe],[1,b.rightGuideShoe]]){
    for(const child of[...shoe.children]){child.geometry.dispose();shoe.remove(child);}
    const mirrored=side<0?section.map(p=>p.map(r=>r.map(([x,z])=>[-x,z]).reverse())):section;
    const body=new THREE.Mesh(plate(mirrored,-yokeTop,-yokeBottom).rotateX(Math.PI/2),b.yokeBody.material);
    body.userData.role=`${side<0?'left':'right'}-one-piece-C-section-shoe-body-lapping-pillar-D`;
    body.userData.contactX=side*g.guideInnerX;
    shoe.add(body);shoe.userData.contactLiner=body;
  }
  for(const[side,face]of[[-1,b.guideFaces[0]],[1,b.guideFaces[1]]]){replace(face,new THREE.BoxGeometry(.02,g.guideTopY-g.guideBottomY,.34));face.position.set(side*(g.guideInnerX+.01),(g.guideTopY+g.guideBottomY)/2,-.02);
    // The strip lay inside the pillar, its faces flush with the pillar's (z-fighting dark
    // stripe); the pillar's own inner face is the planed guide surface.
    face.visible=false;}
  // The gland was drawn behind the rod and its apparent bore was another solid.
  passageY(b.cylinderTop,.72,.48,.252,.172,.24);b.cylinderTop.position.z=.64;
  passageY(b.cylinderBore,.30,.22,.246,.166,.25);b.cylinderBore.position.set(0,-1.92,.64);
  const glandNeck=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),b.cylinderTop.material);
  passageY(glandNeck,.50,.76,.252,.172,.32);glandNeck.position.set(0,-2.19,.64);
  glandNeck.userData.role='ported-neck-joining-fixed-gland-to-crossbase';b.fixedFrame.add(glandNeck);b.glandNeck=glandNeck;
  const connector=new THREE.Mesh(new THREE.BoxGeometry(.24,.20,.16),b.pistonRod.material);connector.position.set(0,-.60,.64);connector.userData.role='crosshead-to-piston-rod-neck';b.crossheadA.add(connector);b.rodNeck=connector;
  // Brown's crossbase is the cylinder cover (the gland stands on it); the
  // plate crops the cylinder below. A closed bored barrel on the rod axis
  // hangs from the crossbase and encloses the whole stroke, with a round
  // piston running in it: nothing moves bare below the frame.
  const rodZ=b.pistonRod.position.z,half=(g.outputStroke??2*g.crankRadius)/2,baseBottom=b.lowerCrossBase.position.y-.12;
  const headTop=g.pistonHeadTopOffsetY-.04,headBottom=g.pistonHeadBottomOffsetY+.02,barrelOuter=.7,barrelInner=.64;
  replace(b.pistonHead,new THREE.CylinderGeometry(barrelInner-.01,barrelInner-.01,headTop-headBottom,64));
  b.pistonHead.position.set(0,(headTop+headBottom)/2,rodZ);b.pistonHead.userData.role='round-piston-head-in-closed-cylinder';
  const rodTop=g.pistonRodTopOffsetY,rodBottom=headTop-.02;
  replace(b.pistonRod,new THREE.BoxGeometry(.24,rodTop-rodBottom,.16));b.pistonRod.position.y=(rodTop+rodBottom)/2;
  const coverTop=baseBottom+.005,coverBottom=baseBottom-.06,barrelBottom=headBottom-half-.06;
  const cover=new THREE.Mesh(plate(clip.difference(poly(circle([0,0],barrelOuter+.04,96)),rect(.26,.18)),coverBottom,coverTop).rotateX(-Math.PI/2),b.lowerCrossBase.material);
  cover.position.set(0,0,rodZ);cover.userData.role='cylinder-cover-under-crossbase-with-rod-passage';
  const barrel=new THREE.Mesh(tube(barrelOuter,barrelInner,coverBottom+.005-barrelBottom).translate(0,(coverBottom+.005+barrelBottom)/2,0),b.lowerCrossBase.material);
  barrel.position.set(0,0,rodZ);barrel.userData.role='closed-cylinder-barrel-enclosing-piston-stroke';
  const end=new THREE.Mesh(new THREE.CylinderGeometry(barrelOuter+.04,barrelOuter+.04,.06,96),b.lowerCrossBase.material);
  end.position.set(0,barrelBottom+.005-.03,rodZ);end.userData.role='cylinder-bottom-cover';
  // The default view frames the stroke as before; the barrel's foot may crop.
  // (Excluded from the fit only: cameraFitGuide would also drop its shadow.)
  barrel.userData.excludeFromCameraFit=true;end.userData.excludeFromCameraFit=true;
  // Pillars D and the crossbase legs run on down (Brown crops them) to the
  // cylinder's bottom cover, so no frame member stops short in mid-air.
  const floorY=barrelBottom+.005-.06;
  for(const post of[...b.guidePosts,...b.lowerLegs]){const p=post.geometry.parameters,top=post.position.y+p.height/2;
    replace(post,new THREE.BoxGeometry(p.width,top-floorY,p.depth));post.position.y=(top+floorY)/2;}
  b.fixedFrame.add(cover,barrel,end);b.cylinderCover=cover;b.cylinderBarrel=barrel;b.cylinderEnd=end;
  d.finiteGuideReview={cylinderTop:coverTop,cylinderBottom:barrelBottom-.055,barrelInnerRadius:barrelInner,pistonClearanceAtTop:coverBottom-(headTop+half),slotRunningClearance:.0005,guideRunningClearance:.002,qualification:'Exact source crank/slot motion; finite running allowances, inferred rear braces, rod/gland depth and closed cylinder below the crossbase. No steam, bearing loads or friction simulation.'};
}
export function finishPistonGuides(root,update){
  const d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=d.geometry.cyclePeriod;
  root.traverse(o=>{for(const m of[].concat(o.material??[]))m.fog=false;});
  const box=new THREE.Box3();for(let i=0;i<=64;i++){update(d.geometry.cyclePeriod*i/64);root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh||!o.visible||o.userData.cameraFitGuide||o.userData.excludeFromCameraFit)return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});}
  d.cameraFitBounds=box.expandByScalar(.04);d.cameraDistanceScale=1.08;update(0);
}
