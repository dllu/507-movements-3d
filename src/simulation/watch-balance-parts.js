import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { plate, poly, circle, capsule, polygonClipping } from './finite-plate-geometry.js';

const tube=(outer,height,bore)=>boredLatheGeometry([{radial:outer,axial:-height/2},{radial:outer,axial:height/2}],bore,64);
const rectangle=(w,h)=>poly([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]);
function replace(mesh,geometry){mesh.geometry.dispose();mesh.geometry=geometry;}
function collet(parent,radius,bore,z,material){
  const mesh=new THREE.Mesh(tube(radius,.12,bore).rotateX(Math.PI/2),material);
  mesh.position.z=z;mesh.userData.role='staff-keyed-balance-spring-collet';parent.add(mesh);return mesh;
}
function common(root){
  root.userData.blocks.backPlate.visible=false;
  root.userData.hideGround=true;
  root.userData.journalReview={prescribed:true};
}

export function correctWatchRegulator(root){
  const b=root.userData.blocks,g=root.userData.geometry;common(root);
  replace(b.lowerBearing,tube(g.balanceHubRadius*.72,.32,.152));b.lowerBearing.position.z=-.50;
  replace(b.balanceHub,tube(g.balanceHubRadius,.52,.152));
  replace(b.balanceStaff,new THREE.CylinderGeometry(.15,.15,1.99,32));b.balanceStaff.position.z=.28;
  b.springCollet=collet(b.balanceAssembly,g.springInnerRadius+.002,.152,g.springPlaneZ,b.balanceHub.material);
  // Brown's regulator ring is small (about a third of the spring's radius):
  // keep the fixed ring and the lever's ring close round the staff so the
  // balance spring shows as one spiral from the collet out to stud R.
  replace(b.fixedRing,tube(.28,.20,.17).rotateX(Math.PI/2));b.fixedRing.position.z=.98;
  replace(b.regulatorRing,tube(.40,.16,.282).rotateX(Math.PI/2));
  // The arm ends at the base of the pointer's triangular tip, so the two
  // abut on one face instead of overlapping with z-fighting coplanar faces.
  {
    b.pointer.geometry.computeBoundingBox();
    const armEnd=-(b.pointer.position.y+b.pointer.geometry.boundingBox.max.y);
    replace(b.regulatorArm,new THREE.BoxGeometry(.18,armEnd-.38,.16));
    b.regulatorArm.position.y=-(armEnd+.38)/2;
  }
  g.fixedRingInnerRadius=.17;g.fixedRingOuterRadius=.28;
  // The rate scale is a plain silvered sector: no engraved grid of arcs and
  // divisions (tick notation).
  for(const line of [...(b.dialArcs??[]),...(b.dialTicks??[])])line.visible=false;
  // A flat ribbon fits between the actual .02-wide curb opening; the previous .09 wire did not.
  for(const segment of b.springSegments)replace(segment,new THREE.BoxGeometry(.014,1,.12));
  root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-3.95,-5.30,-.85),new THREE.Vector3(3.95,3.70,1.40));
  // Brown draws no balance cock, stud carrier or back bar. The back bar that
  // carried the staff bearing to the scale read, through the balance, as a
  // second fixed lever beside the real one whenever the regulator moved, so
  // it is gone: the scale and the staff's rear bearing stand as drawn.
  // The balance rim is Brown's flat ring (a rectangular section), not a
  // torus; the spokes run 0.1 into it.
  {
    const outer=g.balanceOuterRadius+g.balanceRimTubeRadius,inner=g.balanceOuterRadius-g.balanceRimTubeRadius;
    const rim=polygonClipping.difference(poly(circle([0,0],outer,192)),poly(circle([0,0],inner,192)));
    // As deep as the spokes' .28 plus .02, so no spoke face stands proud.
    replace(b.balanceRim,plate(rim,-.15,.15));
  }
  root.userData.minimumDisplayCycleSeconds=20;
  root.userData.reconstructionNote='The lever prescribes a slow rate adjustment; the balance follows the ideal stiffness/active-length relation. The spring ribbon and curb neutral point are kinematic approximations, not a solved elastic/contact system. The fixed watch bridges outside this source detail are omitted.';
  Object.assign(root.userData.journalReview,{springWidth:.014,curbOpening:.02,shaftRadius:.15,boreRadius:.152});
}

export function correctCompensationBalance(root){
  const b=root.userData.blocks,g=root.userData.geometry;common(root);
  replace(b.fixedBearing,tube(.38,.32,.142));b.fixedBearing.position.z=-.68;
  replace(b.hub,tube(g.hubRadius,.52,.142));
  replace(b.staff,new THREE.CylinderGeometry(.14,.14,1.96,32));b.staff.position.z=.10;
  b.springCollet=collet(b.balanceAssembly,g.springInnerRadius+.002,.142,g.springPlaneZ,b.hub.material);
  // Split the scaled main bar at the hub, leaving the rotating staff passage open.
  const halves=[-1,1].map(side=>new THREE.BoxGeometry(.22,.425,.34).translate(0,side*.2875,0));
  replace(b.mainBar,mergeGeometries(halves));halves.forEach(o=>o.dispose());
  for(const segment of b.springSegments)replace(segment,new THREE.BoxGeometry(.014,1,.10));
  for(const[side,weight]of [[1,b.rightWeight],[-1,b.leftWeight]]){
    const section=polygonClipping.difference(rectangle(g.weightWidth,g.weightDepth),rectangle(.42,.44));
    replace(weight.block,plate(section,-g.weightHeight/2,g.weightHeight/2).rotateX(-Math.PI/2));
    weight.group.children.find(o=>o.userData.role==='compensation-weight-arm-clamp-slot').visible=false;
    replace(weight.clampScrew,new THREE.CylinderGeometry(.10,.10,.14,24));weight.clampScrew.position.z=.29;
    weight.armExtensions=[];
    for(const[layer,offset]of [['brass',.055],['steel',-.055]]){
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(.105,1.15,.42),b.compoundArmSegments[0][0][layer].material);
      mesh.position.set(side*offset,-side*.575,0);mesh.userData.role=`projecting-${layer}-balance-arm`;
      weight.group.add(mesh);weight.armExtensions.push(mesh);
    }
  }
  for(const screw of [b.topTimingScrew,b.bottomTimingScrew]){
    replace(screw.stem,new THREE.CylinderGeometry(.095,.095,1.10,24));
    replace(screw.nut,tube(g.timingNutRadius,.26,.097));
  }
  root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-4.85,-4.85,-.95),new THREE.Vector3(4.85,4.85,1.20));
  root.userData.minimumDisplayCycleSeconds=20;
  root.userData.reconstructionNote='Temperature and balance oscillation are prescribed. The weights move to the radius that preserves the ideal stiffness/inertia ratio; real brass/steel bending and spring softening are not solved. The rear spring is inferred, and timing screws are fixed adjustment settings.';
  Object.assign(root.userData.journalReview,{springWidth:.014,shaftRadius:.14,boreRadius:.142,weightPassageWidth:.42,weightPassageDepth:.44});
}
