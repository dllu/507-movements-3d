import * as THREE from 'three';
import { plate, poly, circle, capsule, polygonClipping as clip } from './finite-plate-geometry.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { rackPinionGeometry, rackToothGeometry } from './rack-pinion-parts.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
export const boredAxialCylinder=(radius,bore,length)=>boredLatheGeometry([
  {radial:radius,axial:-length/2},{radial:radius,axial:length/2}],bore,64);

// Swept finite pin opening, including the sharp branch junctions. A solid tube
// on the centerline is not a slot. The small radial allowance covers the sampled
// centerline chords and the polygonal circular offsets.
function guideStroke(curve,radius) {
  const points=Array.from({length:193},(_,i)=>{const p=curve.getPoint(i/192);return[p.x,p.y];});
  return clip.union(...points.slice(1).map((p,i)=>capsule(points[i],p,radius,8)));
}

// Brown draws each guide b as a D-shaped plate: straight on the side facing
// the wheel, bowed outboard, following the closed groove round at an even
// margin. The plate is the pin locus filled and buffered by that margin.
function guideLoop(curve) {
  return poly(Array.from({length:192},(_,i)=>{const p=curve.getPoint(i/192);return[p.x,p.y];}));
}
function guideOutline(curve,margin=.24) {
  return clip.union(guideLoop(curve),guideStroke(curve,margin));
}

// The groove is sunk into the face of guide b, not cut through it: the front
// plate carries the swept pin opening, and a floor plate closes it behind so
// the island inside the groove is part of the same casting.
export function guideChannelGeometry(curve,low,high) {
  return plate(clip.difference(guideOutline(curve),guideStroke(curve,.125)),low,high);
}
export function guideFloorGeometry(curve,low,high) {
  return plate(guideOutline(curve),low,high);
}

export function guideLipGeometry(curve,low,high) {
  return plate(clip.difference(guideStroke(curve,.18),guideStroke(curve,.125)),low,high);
}

export function correctWeightedRackInterfaces(root) {
  const d=root.userData,b=d.blocks,g=d.geometry;
  for (const guide of [b.leftGuide,b.rightGuide]) {
    const casting=guide.userData.casting,floorZ=g.guidePlaneZ-.02;
    replace(casting,guideChannelGeometry(guide.userData.centerline,floorZ,g.guidePlaneZ+.13));
    // The groove floor: the same casting, a shade darker as a sunk recess.
    const floorMaterial=casting.material.clone();floorMaterial.color.multiplyScalar(.72);
    const floor=new THREE.Mesh(guideFloorGeometry(guide.userData.centerline,g.guidePlaneZ-.13,floorZ),floorMaterial);
    floor.userData.role=`${guide.userData.role}-groove-floor`;floor.castShadow=floor.receiveShadow=true;
    guide.add(floor);guide.userData.floor=floor;
    // No dark lip: Brown's groove edge is ink, not a part.
    guide.remove(guide.userData.slot);guide.userData.slot.geometry.dispose();
  }
  for(const rack of[b.leftRack,b.rightRack]) {
    const boss=rack.userData.pivotBoss;
    replace(boss,boredAxialCylinder(.20,.089,g.rackDepth*1.38));
    // The lower straight bar also surrounds the axle instead of filling the eye.
    const body=rack.userData.body;
    // The bar runs out to the teeth's root line (pitch line 0.26 from the
    // pivot axis, dedendum 0.071), so the teeth stand on the rack itself.
    const inward=-rack.userData.side,outer=-g.rackBodyWidth/2,inner=.26-.071+.004,
      x0=inward*outer,x1=inward*inner,lo=Math.min(x0,x1),hi=Math.max(x0,x1);
    if(body)replace(body,plate(clip.difference(poly([[lo,0],[hi,0],
      [hi,g.rackBodyLength],[lo,g.rackBodyLength]]),poly(circle([0,0],.089,48))),-g.rackDepth/2,g.rackDepth/2));
    if(body)body.position.y=0;
  }
  const guide=b.fixedFrame.children.find(o=>o.userData.role==='fixed-piston-rod-guide-collar');
  replace(guide,boredAxialCylinder(.31,.108,.50));
  if(g.rackRootExtension){
    // The extended racks turn on pins ahead of the crosshead, not through its web.
    // The pins pass through bored bosses on the crosshead, not solid stock.
    const pivots=[d.stateAtTime(0).leftRack.pivot.x,d.stateAtTime(0).rightRack.pivot.x];
    const beamOutline=clip.union(poly([[-1.21,-.09],[1.21,-.09],[1.21,.09],[-1.21,.09]]),...pivots.map(x=>poly(circle([x,0],.16,64))));
    replace(b.crossheadBeam,plate(clip.difference(beamOutline,...pivots.map(x=>poly(circle([x,0],.0875,64)))),-.10,.10));b.crossheadBeam.position.z=-.30;
    for(const rack of[b.leftRack,b.rightRack]){
      replace(rack.userData.pivotBore,new THREE.CylinderGeometry(.085,.085,.94,32));rack.userData.pivotBore.position.z=-.10;
      replace(rack.userData.guidePin,new THREE.CylinderGeometry(.115,.115,.64,32));rack.userData.guidePin.position.z=-.14;
    }
    const base=b.fixedFrame.children.find(o=>o.userData.role==='fixed-machine-bed');
    base.position.y=g.crossheadLowY-.65;
    const outline=poly([[-3.025,-.725],[3.025,-.725],[3.025,.725],[-3.025,.725]]);
    const baseGeometry=plate(clip.difference(outline,poly(circle([0,-.06],.14,64))),-.13,.13).rotateX(-Math.PI/2);
    replace(base,baseGeometry);
    // The input rod remains in its guide even at the top of the stroke.
    replace(b.pistonRod,new THREE.CylinderGeometry(.10,.10,g.stroke+.90,40));b.pistonRod.position.set(0,-(g.stroke+.90)/2+.025,-.30);
    guide.position.set(0,g.crossheadLowY-.40,-.30);b.inputIndex.position.z=-.17;
    const post=b.fixedFrame.children.find(o=>o.userData.role==='fixed-output-shaft-bearing-standard');
    const bottom=base.position.y+.13;
    const postOutline=clip.union(poly([[-.14,bottom],[.14,bottom],[.14,0],[-.14,0]]),poly(circle([0,0],.24,64)));
    replace(post,plate(clip.difference(postOutline,poly(circle([0,0],.109,64))),-.17,.17));post.position.y=0;
    replace(b.outputGear.userData.shaft,new THREE.CylinderGeometry(.105,.105,1.60,40));b.outputGear.userData.shaft.position.z=-.25;
    for(const support of b.fixedFrame.children.filter(o=>o.userData.role==='fixed-guide-groove-support-standard')){
      const upper=support.children[2].position.clone(),lower=support.children[1].position.clone();lower.y=base.position.y+.13;
      support.userData.setEndpoints(lower,upper);
    }
  }
  d.finiteInterfaceReview={qualification:'Finite guide slots, extended lower rack pivots and bored joints; guide selection during the crosshead dwells and spring assistance remain prescribed, not a passive force solution.',rackRootExtension:g.rackRootExtension??0};
}

export function correctWeightedRackTeeth(root) {
  const d=root.userData,b=d.blocks,g=d.geometry,R=g.pinionPitchRadius,p=g.circularPitch;
  const addendum=.065;
  const extension=g.rackRootExtension??0;
  const firstY=g.crossheadLowY+extension+.24;
  const phase=-firstY/R-g.pinionAngularPitch/2;
  replace(b.outputGear.userData.wheel,rackPinionGeometry({radius:R,teeth:g.pinionToothCount,addendum,depth:.48,bore:.108}).rotateZ(phase));
  const rightFirstY=R*(phase+g.pinionAngularPitch/2-Math.PI);
  const rightOffset=((rightFirstY-g.crossheadHighY-extension)%p+p)%p+extension;
  for(const rack of [b.leftRack,b.rightRack])for(const tooth of rack.userData.teeth) {
    const side=rack.userData.side;
    replace(tooth,rackToothGeometry({pitch:p,addendum,depth:g.rackDepth*.94}).rotateZ(side<0?-Math.PI/2:Math.PI/2).translate(-side*.26,0,0));
    if(side>0)tooth.position.y=rightOffset+tooth.userData.materialToothIndex*p;
    else tooth.position.y=.24+extension+tooth.userData.materialToothIndex*p;
  }
  d.finiteInterfaceReview.toothProfile={addendum,phase,rightOffset};
}

export function finishAlternatingDrive(root,update,period) {
  root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=period;
  root.traverse(o=>{for(const m of [].concat(o.material??[]))m.fog=false;});
  const bounds=new THREE.Box3();for(let i=0;i<=64;i++){update(period*i/64);root.updateMatrixWorld(true);bounds.union(new THREE.Box3().setFromObject(root));}
  root.userData.cameraFitBounds=bounds.expandByScalar(.04);root.userData.cameraDistanceScale=1.15;update(0);
}


export function correctDualBandInterfaces(root) {
  const {blocks:b}=root.userData;
  for(const carrier of[b.openCarrier,b.crossedCarrier]) {
    const {pulley,hub,groove}=carrier.userData;
    // A concave groove encloses the round band with 0.005 radial allowance.
    // The old solid torus occupied the band's entire centerline.
    const R=.5,r=.039;
    const profile=[{axial:-.11,radial:R+.045},{axial:-.045,radial:R+.045},
      ...Array.from({length:25},(_,i)=>{const z=r*(i/12-1);return{axial:z,radial:R-Math.sqrt(Math.max(0,r*r-z*z))};}),
      {axial:.045,radial:R+.045},{axial:.11,radial:R+.045}];
    replace(pulley,boredLatheGeometry(profile,.108,96));
    replace(hub,boredAxialCylinder(.13,.108,.27));
    // This decoration becomes a real external flange instead of a solid plug.
    replace(groove,boredAxialCylinder(.545,.525,.020).rotateX(Math.PI/2));
    groove.position.z=pulley.position.z-.095;
  }
  for(const wheel of[b.openRatchet,b.crossedRatchet]) {
    const shape=wheel.geometry.parameters.shapes.clone(),hole=new THREE.Path();
    hole.absarc(0,0,.107,0,2*Math.PI,false);shape.holes.push(hole);
    replace(wheel,new THREE.ExtrudeGeometry(shape,{depth:.10,bevelEnabled:false,curveSegments:32}).translate(0,0,-.05));
  }
  const post=b.frame.children.find(o=>o.userData.role==='fixed-flywheel-shaft-bearing-post');
  // One upright behind the flywheel carries both the flywheel shaft (bored
  // boss) and the fixed fulcrum pin a (boss at its head), standing on a small
  // foot; nothing else of a frame is drawn.
  const pinY=b.pivotPin.position.y+.78;
  const outline=clip.union(poly([[-.125,-.765],[.125,-.765],[.125,pinY],[-.125,pinY]]),poly(circle([0,.78],.18,64)),poly(circle([0,pinY],.20,64)));
  replace(post,plate(clip.difference(outline,poly(circle([0,.78],.108,64))),-.14,.14));
  // Brown draws no upright (the presentation removes it), so pin a is only a
  // stub through the lever boss (z 0.30 to 0.68), 0.06 proud of each face.
  const pinBack=.24,pinFront=.74;
  replace(b.pivotPin,new THREE.CylinderGeometry(.13,.13,pinFront-pinBack,32).rotateX(Math.PI/2));b.pivotPin.rotation.set(0,0,0);b.pivotPin.position.z=(pinFront+pinBack)/2;
  const base=b.frame.children.find(o=>o.userData.role==='rectifier-frame-base');
  replace(base,new THREE.BoxGeometry(.90,.22,.40));base.position.set(0,-1.61,post.position.z-.08);
  root.userData.finiteInterfaceReview={qualification:'Finite loose-pulley grooves, shaft journals and fast-wheel bores. The original prescribed pawl lift is not a finite-contact solution; the undersized pawls remain a measured follow-up.'};
}
