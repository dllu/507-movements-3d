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
export function guideChannelGeometry(curve,low,high) {
  const points=Array.from({length:193},(_,i)=>{const p=curve.getPoint(i/192);return[p.x,p.y];});
  const stroke=radius=>clip.union(...points.slice(1).map((p,i)=>capsule(points[i],p,radius,8)));
  return plate(clip.difference(stroke(.18),stroke(.125)),low,high);
}

export function correctWeightedRackInterfaces(root) {
  const d=root.userData,b=d.blocks,g=d.geometry;
  for (const guide of [b.leftGuide,b.rightGuide]) {
    const geometry=guideChannelGeometry(guide.userData.centerline,g.guidePlaneZ-.13,g.guidePlaneZ+.13);
    replace(guide.userData.casting,geometry);
    // The dark lip surrounds the same opening, rather than plugging it.
    const lip=geometry.clone().scale(1,1,.012/.26)
      .translate(0,0,g.guidePlaneZ+.136-g.guidePlaneZ*.012/.26);
    replace(guide.userData.slot,lip);guide.userData.slot.position.z=0;
  }
  for(const rack of[b.leftRack,b.rightRack]) {
    const boss=rack.userData.pivotBoss;
    replace(boss,boredAxialCylinder(.20,.089,g.rackDepth*1.38));
    // The lower straight bar also surrounds the axle instead of filling the eye.
    const body=rack.userData.body;
    if(body)replace(body,plate(clip.difference(poly([[-g.rackBodyWidth/2,0],[g.rackBodyWidth/2,0],
      [g.rackBodyWidth/2,g.rackBodyLength],[-g.rackBodyWidth/2,g.rackBodyLength]]),poly(circle([0,0],.089,48))),-g.rackDepth/2,g.rackDepth/2));
    if(body)body.position.y=0;
  }
  const guide=b.fixedFrame.children.find(o=>o.userData.role==='fixed-piston-rod-guide-collar');
  replace(guide,boredAxialCylinder(.31,.108,.50));
  d.finiteInterfaceReview={qualification:'Finite guide slots and bored joints; guide selection and spring assistance remain prescribed.'};
}

export function correctWeightedRackTeeth(root) {
  const d=root.userData,b=d.blocks,g=d.geometry,R=g.pinionPitchRadius,p=g.circularPitch;
  const addendum=.065;
  const firstY=g.crossheadLowY+.24;
  const phase=-firstY/R-g.pinionAngularPitch/2;
  replace(b.outputGear.userData.wheel,rackPinionGeometry({radius:R,teeth:g.pinionToothCount,addendum,depth:.48,bore:.108}).rotateZ(phase));
  const rightFirstY=R*(phase+g.pinionAngularPitch/2-Math.PI);
  const rightOffset=((rightFirstY-g.crossheadHighY)%p+p)%p;
  for(const rack of [b.leftRack,b.rightRack])for(const tooth of rack.userData.teeth) {
    const side=rack.userData.side;
    replace(tooth,rackToothGeometry({pitch:p,addendum,depth:g.rackDepth*.94}).rotateZ(side<0?-Math.PI/2:Math.PI/2).translate(-side*.26,0,0));
    if(side>0)tooth.position.y=rightOffset+tooth.userData.materialToothIndex*p;
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
  const outline=clip.union(poly([[-.125,-.765],[.125,-.765],[.125,.765],[-.125,.765]]),poly(circle([0,.78],.18,64)));
  replace(post,plate(clip.difference(outline,poly(circle([0,.78],.108,64))),-.14,.14));
  root.userData.finiteInterfaceReview={qualification:'Finite loose-pulley grooves, shaft journals and fast-wheel bores. The original prescribed pawl lift is not a finite-contact solution; the undersized pawls remain a measured follow-up.'};
}
