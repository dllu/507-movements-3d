import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import { PALETTE, makeBevelGear } from './primitives.js';

const rectangle = (w,h,cx=0,cy=0) => poly([[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]]);
const tube = (r,h,bore) => boredLatheGeometry([{radial:r,axial:-h/2},{radial:r,axial:h/2}],bore,64);
function replace(mesh, geometry) { mesh.geometry.dispose(); mesh.geometry=geometry; }
function drilledBox(w,h,d,r,cy=0) {
  return plate(polygonClipping.difference(rectangle(w,h),poly(circle([0,cy],r,64))),-d/2,d/2);
}
function hide(object) { object.visible=false; }

export function correctConicalJournals(root) {
  const b=root.userData.blocks,g=root.userData.geometry;
  const byRole=role=>b.fixedFrame.children.find(o=>o.userData.role===role);
  b.upperBearing=byRole('fixed-upper-spindle-bearing');
  b.lowerBearing=byRole('fixed-lower-spindle-bearing');
  replace(b.upperBearing,tube(.48,.50,.162));
  replace(b.lowerBearing,tube(.43,.40,.162));
  b.lowerBearing.position.y=-5.13;
  replace(b.bearingPlate,drilledBox(3.15,1.72,.30,.162).rotateX(Math.PI/2));
  replace(b.spindle,new THREE.CylinderGeometry(.16,.16,2.22,40));
  b.spindle.position.y=-1.05;
  // The hub is fast on the spindle, so it is solid: the open bore let the
  // arm show through it (speckled where their faces met).
  replace(b.crankHub,new THREE.CylinderGeometry(.40,.40,.42,48));
  // Brown draws a toothed bevel pinion under the bearing bar (large end up),
  // not a smooth cone: the spindle's drive to the clockwork.
  const pinion=makeBevelGear({teeth:14,radius:.46,depth:.3,color:PALETTE.brass,axis:new THREE.Vector3(0,-1,0)});
  for(const child of [...pinion.userData.rotor.children])if(child.geometry?.type==='BoxGeometry'){pinion.userData.rotor.remove(child);child.geometry.dispose();}
  pinion.position.y=-1.21;pinion.userData.role='toothed-bevel-drive-pinion';
  b.spindleRotor.remove(b.driveCollar);b.driveCollar.geometry.dispose();
  b.spindleRotor.add(pinion);b.driveCollar=pinion;b.drivePinion=pinion;
  // Brown draws the bearing bar and the foot with nothing between them: one
  // plain pillar behind the spindle carries the bar on the foot.
  const pillarTop=b.bearingPlate.position.y-.15,pillarBottom=-5.32;
  const pillar=new THREE.Mesh(new THREE.BoxGeometry(.3,pillarTop-pillarBottom,.2),b.bearingPlate.material);
  pillar.position.set(0,(pillarTop+pillarBottom)/2,-.7);pillar.userData.role='fixed-bearing-bar-back-pillar';
  b.fixedFrame.add(pillar);b.backPillar=pillar;
  replace(b.bob,tube(g.bobRadius,g.bobLength,.087));
  const ballRadius=.225,bore=.087,limit=Math.sqrt(ballRadius**2-(bore+.0001)**2);
  replace(b.lowerSocket,boredLatheGeometry(Array.from({length:49},(_,i)=>{
    const axial=-limit+2*limit*i/48;return{axial,radial:Math.sqrt(ballRadius**2-axial**2)};
  }),bore,64));
  for(const object of [b.wristPin,b.jointMarker,b.lowerPinTail])hide(object);
  // Closed spherical seat: its inner meridian follows the bored ball, with .002 clearance.
  const section=[new THREE.Vector2(.31,-.16),new THREE.Vector2(.31,.16),
    ...Array.from({length:33},(_,i)=>{const y=.16-.32*i/32;return new THREE.Vector2(Math.sqrt(.227**2-y*y),y);}),new THREE.Vector2(.31,-.16)];
  const seat=new THREE.Mesh(new THREE.LatheGeometry(section,64),b.crankHub.material);
  seat.position.set(g.crankRadius,0,0);seat.userData.role='spherical-lower-crank-journal';
  b.spindleRotor.add(seat);b.sphericalSeat=seat;
  const outline=polygonClipping.union(rectangle(g.crankRadius+.62,.28,(g.crankRadius-.62)/2),poly(circle([0,0],.34,64)),poly(circle([g.crankRadius,0],.37,64)));
  const cut=polygonClipping.difference(outline,poly(circle([0,0],.162,64)),poly(circle([g.crankRadius,0],.27,64)));
  b.crankArm.children.forEach(hide);
  const arm=new THREE.Mesh(plate(cut,-.11,.11).rotateX(Math.PI/2),b.spindle.material);
  b.crankArm.add(arm);b.actualCrankArm=arm;
  root.userData.hideGround=true;
  root.userData.minimumDisplayCycleSeconds=8;
  root.userData.reconstructionNote='The spindle prescribes the conical motion. The lower connection is reconstructed as a spherical journal; the thin upper wire is an ideal flexure. Operating speed, loads and wire stresses are not dynamically simulated.';
  root.userData.journalReview={ballRadius,seatRadius:.227,shaftRadius:.16,shaftBore:.162,prescribed:true};
}

export function correctCompensationJournals(root,id) {
  const b=root.userData.blocks,g=root.userData.geometry,isMercury=id===316;
  const radius=isMercury?.18:.17,hubLength=isMercury?.74:.72;
  const brackets=b.fixedFrame.children.filter(o=>o.userData.role==='fixed-pendulum-pivot-bracket');
  brackets.forEach((o,i)=>{
    const offset=isMercury?.17:.10;
    replace(o,drilledBox(.44,isMercury?.78:.68,.20,radius+.002,-offset));
    o.position.set(0,g.pivot.y+offset,(i?1:-1)*(hubLength/2+.12));
  });
  replace(b.movingPivotHub,tube(isMercury?.30:.28,hubLength,radius+.002));
  b.pivotBrackets=brackets;
  if(!isMercury){
    for(const weight of [b.leftEndWeight,b.rightEndWeight]){
      // A rectangular sliding passage follows the flat two-layer bar, rather than a painted solid cylinder.
      const cut=polygonClipping.difference(rectangle(1.20,1.01),rectangle(1.06,.31));
      replace(weight.block,plate(cut,-.58,.58).rotateY(Math.PI/2));
      hide(weight.bore);
      replace(weight.outerStem,new THREE.BoxGeometry(.72,.21,1.02));
      weight.outerStem.rotation.z=0;weight.witness.position.z=.68;
    }
    hide(b.mainBobHub);
    b.lowerAdjuster.position.z=b.rod.position.z;
    b.lowerThread.position.z=b.rod.position.z;
    replace(b.lowerAdjuster,tube(.31,.34,.087));
    // Preserve the source's rounded shoulders while drilling along the actual, offset rod axis.
    const {mainBobWidth:w,mainBobHeight:h,mainBobDepth:d}=g;
    const shape=new THREE.Shape([[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(p=>new THREE.Vector2(...p)));
    const hole=new THREE.Path();hole.absarc(0,.16,.087,0,Math.PI*2,false);shape.holes.push(hole);
    const geom=new THREE.ExtrudeGeometry(shape,{depth:h,steps:40,bevelEnabled:false,curveSegments:32});
    const p=geom.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i),y=p.getY(i);
      if(Math.abs(x)>.2&&z>h-.52){const half=w/2-.52+Math.sqrt(Math.max(0,.52**2-(z-(h-.52))**2));p.setX(i,x*half/(w/2));}
    }
    geom.translate(0,0,-h/2).rotateX(-Math.PI/2);geom.computeVertexNormals();replace(b.mainBob,geom);
  }
  root.userData.hideGround=true;
  root.userData.minimumDisplayCycleSeconds=12;
  root.userData.reconstructionNote=isMercury
    ? 'Swing and temperature are prescribed and exaggerated. Mercury height is chosen to preserve the ideal compound-pendulum effective length I/Q; this is not a fluid or material-expansion simulation. The adjustment thread and jar supports are illustrative.'
    : 'Swing and temperature are prescribed and exaggerated. The bar curvature is chosen to preserve the ideal compound-pendulum effective length I/Q; it is not calculated from real steel/brass expansion or bending stiffness. The upper suspension beyond the cropped engraving is inferred.';
  root.userData.journalReview={shaftRadius:radius,shaftBore:radius+.002,prescribed:true};
}
