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
    ring(b.ringBody,'support355');b.ringOutline.visible=false;
    b.leftSpindleCap.visible=false; // The short left end terminates inside its journal.
    b.bearingHousings.forEach(h=>bearing(h,b.spindle,g.bearingOuterRadius,g.bearingLength,.096));
    // The original oversized ring intersects the spinning rim at both crossings.
    for(const moving of[b.diskBody,b.diskRim,b.spindle,b.hub,...b.spinIndexes,b.rightSpindleKnob,b.knobBulb]){
      for(const fixed of[b.ringBody,...b.bearingHousings,b.pillar,b.supportCup,b.supportCupRim,b.pintle,b.curvedNeck])pair(moving,fixed);
    }
    d.cameraDirection=new THREE.Vector3(7,3.8,12);
    d.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-4.75,-2.48,-1.5),new THREE.Vector3(4.75,3.10,1.5));
    d.cameraFramingScope='View-fit proxy, not a world swept bounding box; checked against all visible vertices through full precession.';
    d.minimumDisplayCycleSeconds=12;
    d.reconstructionNote='The disk and ring follow ideal steady horizontal precession, with twelve rotor turns per precession. Masses and dimensions are inferred. Nutation, release transients, bearing friction and stability under disturbance are not simulated.';
    d.dynamics.validationScope='Prescribed horizontal regular-precession solution and spin-angular-momentum balance; no release or contact-dynamics validation.';
  }else{
    ring(b.outerRing,'outer356');ring(b.middleRing,'middle356');ring(b.innerRing,'inner356');
    [...b.outerEdgeLines,...b.middleEdgeLines,...b.innerEdgeLines].forEach(o=>o.visible=false);
    b.middlePivotBearings.forEach((h,i)=>bearing(h,b.middlePivotPins[i],g.bearingRadius,.055,.081));
    b.innerPivotBearings.forEach((h,i)=>bearing(h,b.innerPivotPins[i],g.bearingRadius*.91,.20,.074));
    b.rotorBearingHousings.forEach(h=>bearing(h,b.rotorShaft,g.bearingRadius*.82,.17,.070));
    journal(b.lowerYawTrunnion,.12,.36,.081);
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
    for(const moving of[b.heavyBall,b.ballEquator,b.rotorShaft,b.rotorHub,...b.shaftCaps,...b.ballSpinIndexes]){
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
  d.gyroscopeParts=p;d.hideGround=true;d.cameraDistanceScale=id===355?.72:1;
  root.traverse(o=>{for(const material of[].concat(o.material??[]))material.fog=false;});
}
