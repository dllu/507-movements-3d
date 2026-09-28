import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import baked from './generated/gyroscope-rings.js';

function replace(mesh, geometry) { mesh.geometry.dispose(); mesh.geometry=geometry; }
function journal(mesh, radius, length, bore) {
  replace(mesh,boredLatheGeometry([{radial:radius,axial:-length/2},{radial:radius,axial:length/2}],bore,64));
}
function ring(mesh,key) {
  const source=new THREE.BufferGeometry();
  source.setAttribute('position',new THREE.Float32BufferAttribute(baked[key].positions,3));
  source.setIndex(baked[key].indices);
  replace(mesh,toCreasedNormals(source,Math.PI/6));source.dispose();mesh.rotation.set(0,0,0);
}

export function correctGyroscopeParts(root,id) {
  const d=root.userData,b=d.blocks,g=d.geometry;
  const p={pairs:[],journals:[]};
  const pair=(a,c)=>p.pairs.push([a,c]);
  const bearing=(housing,pin,radius,length,bore)=>{
    journal(housing,radius,length,bore);pair(pin,housing);p.journals.push({housing,pin,bore});
  };
  if(id===355){
    ring(b.ringBody,'support355');
    // Disk C is Brown's flywheel: a heavy rim, a thinner web and a bell hub
    // flaring from the spindle towards the pillar side (lathe axis +y is the
    // mesh's -x after its quarter turn). One lathed solid, bored round the
    // brass hub with 0.002 clearance.
    {
      const R=g.diskRadius,rimIn=R*.8,web=.06,half=g.diskThickness/2,bell=[];
      for(let i=0;i<=16;i++){const t=i/16;bell.push({radial:.30+(.64-.30)*(1-t)**2.2,axial:web+(.46-web)*t});}
      replace(b.diskBody,boredLatheGeometry([
        {radial:.36,axial:-.12},{radial:rimIn-.05,axial:-web},{radial:rimIn,axial:-half},
        {radial:R,axial:-half},{radial:R,axial:half},{radial:rimIn,axial:half},
        {radial:rimIn-.05,axial:web},...bell,
      ],.272,160));
    }
    b.leftSpindleCap.visible=false; // The short left end terminates inside its journal.
    for(const o of[b.pillarIndex,b.ringIndex,...b.spinIndexes])o.visible=false; // Brown draws no white indices.
    b.bearingHousings.forEach(h=>bearing(h,b.spindle,g.bearingOuterRadius,g.bearingLength,.096));
    // The original oversized ring intersects the spinning rim at both crossings.
    for(const moving of[b.diskBody,b.spindle,b.hub,...b.spinIndexes,b.rightSpindleKnob,b.knobBulb]){
      for(const fixed of[b.ringBody,...b.bearingHousings,b.pillar,b.supportCup,b.pintle,b.curvedNeck])pair(moving,fixed);
    }
    d.cameraDirection=new THREE.Vector3(1,3.4,12);
    // The full precession sweep, so disk C and ring A stay in view as they
    // turn round the pillar.
    d.sweptBounds=new THREE.Box3(new THREE.Vector3(-4.75,-2.48,-4.75),new THREE.Vector3(4.75,3.55,4.75));
    // View-fit proxy: the sweep is a circle about the pintle, whose square
    // box would project with inflated corners; this box has the circle's
    // projected width and height in the raised plate view.
    d.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-2.7,-2.48,-2.7),new THREE.Vector3(2.7,3.55,2.7));
    d.cameraFramingScope='Whole precession sweep (proxy box inside sweptBounds for the circular path).';
    d.minimumDisplayCycleSeconds=12;
    d.reconstructionNote='The disk and ring follow ideal steady horizontal precession, with twelve rotor turns per precession. Masses and dimensions are inferred. Nutation, release transients, bearing friction and stability under disturbance are not simulated.';
    d.dynamics.validationScope='Prescribed horizontal regular-precession solution and spin-angular-momentum balance; no release or contact-dynamics validation.';
  }else{
    // Brown's pedestal is one turned piece: a broad round foot, a concave
    // trumpet flare, a slender waist and a collar under the ring's bearing
    // post (radii from the plate at 0.0135 per pixel). It replaces the
    // stacked discs; the bored post stays as the upper stem.
    {
      const y0=b.baseFoot.position.y,pts=[[0,-2.61],[1.0,-2.61],[1.0,-2.52],[.97,-2.47],[.66,-2.42]];
      for(let i=1;i<=14;i++){const t=i/14,u=1-t;pts.push([u*u*.66+2*u*t*.36+t*t*.33,u*u*-2.42+2*u*t*-2.36+t*t*-1.98]);}
      pts.push([.36,-1.62],[.43,-1.60],[.43,-1.48],[0,-1.48]);
      replace(b.baseFoot,new THREE.LatheGeometry(pts.map(([r,y])=>new THREE.Vector2(r,y-y0)),96));
      b.baseFoot.userData.role='fixed-turned-trumpet-pedestal-of-Bohnenberger-machine';
      for(const o of[b.baseTier,b.pedestalNeck])o.removeFromParent();
    }
    ring(b.outerRing,'outer356');ring(b.middleRing,'middle356');ring(b.innerRing,'inner356');
    b.middlePivotBearings.forEach((h,i)=>bearing(h,b.middlePivotPins[i],g.bearingRadius,.055,.081));
    b.innerPivotBearings.forEach((h,i)=>bearing(h,b.innerPivotPins[i],g.bearingRadius*.91,.20,.074));
    b.rotorBearingHousings.forEach(h=>bearing(h,b.rotorShaft,g.bearingRadius*.82,.17,.070));
    // Bore 0.0835, not 0.081: the 0.081 bore wall coincided with ring A and the A–A1 bearing (p90 flicker screen).
    journal(b.lowerYawTrunnion,.12,.36,.0835);
    journal(b.supportColumn,.23,b.supportColumn.geometry.parameters.height,.126);
    pair(b.lowerYawTrunnion,b.supportColumn);
    b.middlePivotPins.forEach(pin=>{pair(pin,b.outerRing);pair(pin,b.lowerYawTrunnion);});
    b.innerPivotPins.forEach(pin=>pair(pin,b.middleRing));
    // Surface-following asymmetric rotor marks, rather than floating flat bars.
    b.ballSpinIndexes.forEach((o,i)=>{
      const side=o.userData.side;
      if(i%2===0){
        replace(o,new THREE.SphereGeometry(g.ballRadius+.006,48,8,.18,1.05,Math.PI*.32,.045));
        o.position.set(0,0,0);o.rotation.set(side<0?Math.PI:0,0,0);
      }else{o.position.normalize().multiplyScalar(g.ballRadius+.018);}
    });
    for(const moving of[b.heavyBall,b.rotorShaft,b.rotorHub,...b.shaftCaps,...b.ballSpinIndexes]){
      for(const fixed of[b.innerRing,b.middleRing,b.outerRing,...b.rotorBearingHousings,...b.innerPivotBearings,...b.middlePivotBearings,b.supportColumn])pair(moving,fixed);
    }
    pair(b.innerRing,b.middleRing);pair(b.middleRing,b.outerRing);pair(b.innerRing,b.outerRing);
    b.middlePivotBearings.forEach(o=>pair(o,b.middleRing));
    b.innerPivotBearings.forEach(o=>pair(o,b.innerRing));
    d.cameraDirection=new THREE.Vector3(0,1.0,15);
    d.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-2.35,-2.63,-2.35),new THREE.Vector3(2.35,3.40,2.35));
    d.minimumDisplayCycleSeconds=12;
    d.reconstructionNote='The outer ring is deliberately turned while equal opposite gimbal motion holds the ball axis fixed. Eighteen rotor turns accompany each handling cycle. This is a prescribed frictionless illustration; resistance to applied pressure, bearing friction and transient dynamics are not simulated.';
    d.dynamics.validationScope='Prescribed gimbal compensation and ideal spin momentum only; no applied-pressure or passive-response validation.';
  }
  d.gyroscopeParts=p;d.hideGround=true;d.cameraDistanceScale=id===355?.64:1;
  root.traverse(o=>{for(const material of[].concat(o.material??[]))material.fog=false;});
}
