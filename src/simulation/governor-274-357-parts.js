import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { makeBoredPlanarLink } from './bored-planar-link.js';
import { bevelToothGeometry, bevelBodyGeometry } from './bevel-geometry.js';
import { tubePathUpdater } from './update-tube-path.js';
import { makeBeam, matte, PALETTE, markShadows } from './primitives.js';
const Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
const replace=(mesh,g)=>{mesh.geometry.dispose();mesh.geometry=g;};
function bore(mesh,r,l,hole){replace(mesh,boredLatheGeometry([{radial:r,axial:-l/2},{radial:r,axial:l/2}],hole,64));}
function gear(assembly,{teeth,radius,outer,fraction=.82,height,bore:hole,sign=1,phase=0,axis,color}){
 const rotor=assembly.userData.rotor??new THREE.Group();const old=new Set();assembly.traverse(o=>{if(o.geometry)old.add(o.geometry);});for(const g of old)g.dispose();assembly.clear();rotor.clear();assembly.add(rotor);
 assembly.quaternion.setFromUnitVectors(Z,axis);
 const teethGeometry=bevelToothGeometry({teeth,innerDistance:outer*fraction,outerDistance:outer,pitchConeAngle:Math.atan(radius/outer),toothHeight:height,toothThicknessFactor:.96,flankSegments:20,tipSegments:8});
 const bodyGeometry=bevelBodyGeometry(teethGeometry,hole),material=matte(color);
 for(const geometry of[teethGeometry,bodyGeometry]){if(sign<0)geometry.rotateY(Math.PI);geometry.translate(0,0,-sign*outer);}
 const body=new THREE.Mesh(bodyGeometry,material);body.userData.role='finite-bored-conical-gear-body';rotor.add(body);
 const teethGroup=new THREE.Group();teethGroup.rotation.z=phase;rotor.add(teethGroup);
 const toothMeshes=Array.from({length:teeth},(_,i)=>{const t=new THREE.Mesh(teethGeometry,i?material:matte(PALETTE.white));t.rotation.z=i*2*Math.PI/teeth;t.userData={bevelTooth:true,toothIndex:i};teethGroup.add(t);return t;});
 Object.assign(assembly.userData,{rotor,body,toothMeshes,teeth,pitchRadius:radius,phase,toothProfile:'back-cone-involute-approximation',boreRadius:hole});
 return assembly;
}
function finish(root,note){const d=root.userData;d.minimumDisplayCycleSeconds=12;d.hideGround=true;d.reconstructionNote=note;d.cameraDirection=new THREE.Vector3(.4,1.1,15);d.cameraFov=12;d.cameraDistanceScale=.85;root.traverse(o=>{for(const m of[].concat(o.material??[]))m.fog=false;});markShadows(root);}
export function correctParabolicGovernor(root){
 const d=root.userData,b=d.blocks,g=d.geometry,p={pairs:[],pins:[]};
 const sleeve=b.sleeveAssembly.children.find(o=>o.userData.role==='sliding-sleeve-on-spindle-C-D');bore(sleeve,g.sleeveRadius,g.sleeveLength,.111);
 bore(b.lowerBearing.children[0],.25,.28,.111);p.pairs.push([b.spindle,sleeve],[b.spindle,b.lowerBearing.children[0]]);
 b.sleeveAssembly.children.find(o=>o.userData.role==='sleeve-cross-pin-joining-both-rods-F').visible=false;
 b.sideAssemblies.forEach((a,i)=>{
  const r=a.roller.userData.blocks;bore(r.wheel,g.rollerRadius,g.rollerWidth,.074);
  replace(r.axle,new THREE.CylinderGeometry(.06815,.06815,.95,48));p.pairs.push([r.axle,r.wheel],[r.wheel,a.guide]);
  const old=a.connectingRod,rod=makeBoredPlanarLink({length:g.connectingRodLength,width:.085,eyeRadius:.108,boreRadius:.074,depth:.085},old.children[0].material);
  rod.userData.role=old.userData.role;rod.userData.nominalLength=g.connectingRodLength;
  const set=rod.userData.setEndpoints;rod.userData.setEndpoints=(start,end)=>{set(start,end);rod.position.z=.36;};a.side.remove(old);a.side.add(rod);a.connectingRod=rod;
  a.carrierLinks.forEach((o,j)=>o.userData.planeZ=j===0?-.27:.27);
  const sign=i===0?1:-1,pin=new THREE.Mesh(new THREE.CylinderGeometry(.068,.068,.34,48),sleeve.material);pin.rotation.x=Math.PI/2;pin.position.set(sign*g.sleevePinRadius,0,sign*.29);pin.userData.role='sleeve-side-pin-for-rod-F';b.sleeveAssembly.add(pin);p.pins.push(pin);
  const arm=makeBeam(new THREE.Vector3(sign*.28,0,0),new THREE.Vector3(sign*g.sleevePinRadius,0,sign*.29),{color:PALETTE.driven,thickness:.10,depth:.12});b.sleeveAssembly.add(arm);
  p.pairs.push([r.axle,rod],[pin,rod],[rod,a.guide],[rod,b.spindle],[rod,a.flyball.userData.blocks.ball]);
 });
 b.base.visible=false;b.baseStem.visible=false;
 d.governorWorkingParts=p;
 finish(root,'The parabolic guides determine the roller and sleeve paths. Their position and spindle speed are prescribed together; this illustrates the linkage, not a simulated passive governor response or stability under changing engine load.');
}
export function correctAndersonGovernor(root,update){
 const d=root.userData,b=d.blocks,g=d.geometry,p={pairs:[],gearPairs:[]};
 const constant=g.sourceInputShaftPhase-5*g.sourceCarrierYaw;
 gear(b.crownGear,{teeth:60,radius:2.55,outer:.51,height:.13,bore:1.90,sign:-1,axis:Y,color:PALETTE.frame});
 gear(b.pinion,{teeth:12,radius:.51,outer:2.55,height:.13,bore:.079,sign:-1,phase:Math.PI/2-constant+Math.PI/12,axis:new THREE.Vector3(1,0,0),color:PALETTE.driver});
 gear(b.carrierDriveGear,{teeth:18,radius:.62,outer:.62,height:.12,bore:.126,axis:Y,color:PALETTE.driver});b.carrierDriveGear.position.y=-2.79;
 gear(b.engineInputGear,{teeth:18,radius:.62,outer:.62,height:.12,bore:.136,sign:-1,phase:Math.PI/18,axis:Z,color:PALETTE.driven});
 b.crownGear.userData.body.userData.role='stationary-toothed-circle-G-body';
 p.gearPairs=[[b.pinion,b.crownGear],[b.engineInputGear,b.carrierDriveGear]];
 b.radialCarrierBeam.position.y=-.80;
 b.hingePins.forEach(pin=>{replace(pin,new THREE.CylinderGeometry(.073,.073,.15,48));pin.position.z=pin.userData.side*.575;});
 const hingeRing=new THREE.Mesh(boredLatheGeometry([{radial:.56,axial:-.04},{radial:.56,axial:.04}],.49,96),b.hingeBearings[0].material);hingeRing.rotation.z=Math.PI/2;hingeRing.userData.role='open-hinge-frame-around-Cardan-joint';b.tiltGroup.add(hingeRing);
 const neck=b.outputRotor.children.find(o=>o.userData.role==='output-yoke-neck-rigid-with-piece-B');
 const inputNeck=b.inputRotor.children.find(o=>o.userData.role==='input-yoke-neck-of-universal-joint');
 replace(neck,new THREE.CylinderGeometry(.17,.17,.28,48));neck.position.x=.31;
 replace(inputNeck,new THREE.CylinderGeometry(.18,.18,.28,48));inputNeck.position.x=-.31;
 replace(b.outputShaft,new THREE.CylinderGeometry(.075,.075,1.62,48));b.outputShaft.position.x=.99;
 const inputLength=g.jointLocal.x-g.pinionCenterLocal.x;replace(b.inputShaft,new THREE.CylinderGeometry(.075,.075,inputLength-.18,48));b.inputShaft.position.x=-(inputLength+.18)/2;
 const neckBearing=new THREE.Mesh(boredLatheGeometry([{radial:.235,axial:-.04},{radial:.235,axial:.04}],.176,64),b.hingeBearings[0].material);neckBearing.rotation.z=Math.PI/2;neckBearing.position.x=.40;neckBearing.userData.role='tilting-journal-for-output-yoke-neck';b.tiltGroup.add(neckBearing);
 const hingeSpokes=[-1,1].map(side=>{const spoke=makeBeam(new THREE.Vector3(0,0,side*.53),new THREE.Vector3(.4,0,side*.20),{color:PALETTE.driver,thickness:.07,depth:.07});b.tiltGroup.add(spoke);return spoke;});
 p.pairs.push([neck,neckBearing],[b.spiderHub,inputNeck],[b.spiderHub,neck],[b.inputShaft,b.spiderHub],[b.outputShaft,b.spiderHub]);
 for(const moving of[b.spiderInputTrunnion,b.spiderOutputTrunnion,...b.inputYokeEyes,...b.outputYokeEyes,b.outputShaft,b.rotorDisk])p.pairs.push([moving,hingeRing]);
 for(const leg of b.ringSupportLegs){leg.updateMatrix();const lower=new THREE.Vector3(0,-1.21,0).applyMatrix4(leg.matrix);root.add(makeBeam(lower,new THREE.Vector3(leg.userData.side*.35,-2.96,0),{color:PALETTE.frame,thickness:.16,depth:.24}));}
 const coil=b.springL.children[0],path=new class extends THREE.Curve{constructor(){super();this.length=4;this.arcLengthDivisions=512;}getPoint(t,p=new THREE.Vector3()){const r=(t===0||t===1)?0:.105*Math.sin(Math.PI*t)**.35,a=t*12*2*Math.PI;return p.set(r*Math.cos(a),t*this.length,r*Math.sin(a));}}();
 replace(coil,new THREE.TubeGeometry(path,192,.027,8,false));const refill=tubePathUpdater(coil.geometry);
 b.springL.userData.setEndpoints=(start,end)=>{const delta=end.clone().sub(start);b.springL.position.copy(start);b.springL.quaternion.setFromUnitVectors(Y,delta.clone().normalize());b.springL.scale.setScalar(1);path.length=delta.length();path.updateArcLengths();refill(path);};
 b.hingeBearings.forEach((h,i)=>{bore(h,.17,.24,.079);p.pairs.push([b.hingePins[i],h]);});
 bore(b.outputBearingCollar,.19,.26,.081);p.pairs.push([b.outputShaft,b.outputBearingCollar]);
 bore(b.valveRodGuide,.14,.34,.081);p.pairs.push([b.valveRodD,b.valveRodGuide]);
 // The old lower standard is an unported block through both rotating shafts.
 const posts=[];for(const x of[-.25,.25])for(const z of[-.36,.36])posts.push(new THREE.BoxGeometry(.10,1.24,.10).translate(x,0,z));
 replace(b.lowerStandard,mergeGeometries(posts));posts.forEach(g=>g.dispose());
 const cap=root.children.find(o=>o.userData.role==='upper-bearing-cap-on-drive-standard');if(cap)bore(cap,.49,.18,.126);
 p.pairs.push([b.verticalCarrierShaft,b.lowerStandard],[b.engineInputShaft,b.lowerStandard]);if(cap)p.pairs.push([b.verticalCarrierShaft,cap]);
 for(const moving of[b.rotorDisk,b.rotorRim,b.outputShaft])for(const fixed of[b.radialCarrierBeam,...b.carrierCageArms,...b.hingeBearings,...b.hingePins,...b.inputYokeEyes,b.spiderInputTrunnion,b.spiderOutputTrunnion])p.pairs.push([moving,fixed]);
 d.governorWorkingParts=p;
 finish(root,'The 60:12 fixed-circle drive and single Cardan joint determine wheel spin. Tilt is prescribed from a quasi-static spring/gyroscopic torque balance. Transient governing, friction, stability and the spring load under real engine disturbances are not simulated.');
 const bounds=new THREE.Box3();for(let i=0;i<=32;i++){update(g.cyclePeriod*i/32);root.updateMatrixWorld(true);bounds.union(new THREE.Box3().setFromObject(root,true));}d.cameraFitBounds=bounds.expandByScalar(.18);update(0);
}
