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
// Rear half of a body of revolution about Y from a closed CCW (radius, y)
// section, closed by the two cut faces Brown's sectional elevation shows.
function halfLatheSolid(section,segments=192){
 let area=0;section.forEach(([r,y],i)=>{const[r2,y2]=section[(i+1)%section.length];area+=r*y2-r2*y;});if(area<0)section=[...section].reverse();
 const pts=[...section,section[0]].map(([r,y])=>new THREE.Vector2(r,y));
 const lathe=new THREE.LatheGeometry(pts,segments,Math.PI/2,Math.PI).toNonIndexed();lathe.deleteAttribute('uv');
 const shape=new THREE.Shape(section.map(([r,y])=>new THREE.Vector2(r,y)));
 const right=new THREE.ShapeGeometry(shape).toNonIndexed();right.deleteAttribute('uv');
 const left=right.clone();left.scale(-1,1,1);const q=left.attributes.position;
 for(let i=0;i<q.count;i+=3)for(let k=0;k<3;k++){const t=q.getComponent(i+1,k);q.setComponent(i+1,k,q.getComponent(i+2,k));q.setComponent(i+2,k,t);}
 const g=mergeGeometries([lathe,right,left]);[lathe,right,left].forEach(o=>o.dispose());return g;
}
// Brown draws the fixed frame as a cast casing in section: a broad bell with
// a pointed, concave-flanked peak and a flared lip that carries circle G, a bowl down to the neck bearing of H's
// shaft, and a flared foot housing the bevel pair with the pulley shaft
// leaving to the right. Only its rear half is modelled, as the section shows.
function castCasing(root,b,p){
 const material=b.lowerStandard.material;
 for(const o of[...root.children])if(/fixed-arch-above|top-bridge-supporting|upper-bearing-cap-on-drive-standard|fixed-cast-base|dark-rim-on-governor-base|fixed-lower-drive-standard|fixed-standard-supporting-stationary-circle-G/.test(o.userData.role??''))o.removeFromParent();
 const shell=new THREE.Mesh(halfLatheSolid([
  [.14,4.92],[.14,4.46],[.40,4.27],[.88,4.04],[1.46,3.77],[2.02,3.41],[2.48,2.92],[2.82,2.34],[3.06,1.72],[3.16,1.20],[2.75,.97],[2.3,.95],[2.3,.83],[2.8,.83],[2.8,.75],[2.75,.4],[2.65,.05],[2.25,-.28],[1.75,-.62],[1.25,-1.0],[.55,-1.15],[.125,-1.15],[.125,-1.5],
  [.62,-1.5],[1.0,-1.32],[1.4,-1.12],[1.95,-.78],[2.55,-.35],[2.9,.1],[2.95,.55],[3.0,.76],[3.3,.80],[3.56,.76],[3.58,.86],[3.30,1.09],[3.2,1.75],[2.95,2.4],[2.6,3.0],[2.1,3.52],[1.5,3.90],[.9,4.17],[.45,4.40],[.26,4.70],[.26,4.92],
 ]),material);
 shell.userData.role='fixed-cast-casing-carrying-circle-G-in-section';root.add(shell);
 // The foot is set back so the pulley shaft M passes the section plane.
 const foot=new THREE.Mesh(halfLatheSolid([
  [.3,-1.5],[.3,-1.62],[.85,-1.62],[1.0,-1.85],[1.05,-2.3],[1.08,-2.9],[1.08,-3.19],[1.55,-3.19],[1.55,-3.1],[1.45,-3.0],[1.3,-2.8],[1.25,-2.2],[1.18,-1.75],[1.0,-1.5],
 ]),material);
 foot.position.z=-.16;foot.userData.role='fixed-cast-foot-housing-bevel-pair';root.add(foot);
 // The engine shaft M leaves to the right, as Brown draws its pulley.
 const mount=new THREE.Group();mount.rotation.y=-Math.PI/2;mount.userData.role='engine-input-mount-turned-to-plate-right';root.add(mount);
 mount.add(b.engineInputGear,b.engineInputRotor);
 const pulley=new THREE.Mesh(boredLatheGeometry([{radial:.34,axial:-.09},{radial:.26,axial:-.03},{radial:.26,axial:.03},{radial:.34,axial:.09}],.13,64),b.engineInputGear.userData.body.material);
 pulley.rotation.x=Math.PI/2;pulley.position.z=-1.58;pulley.userData.role='engine-belt-pulley-on-shaft-M';b.engineInputRotor.add(pulley);
 const shaftBearing=new THREE.Mesh(boredLatheGeometry([{radial:.26,axial:-.1},{radial:.26,axial:.1}],.131,48),material);
 shaftBearing.rotation.z=Math.PI/2;shaftBearing.position.set(1.15,-2.39,0);shaftBearing.userData.role='fixed-foot-bearing-of-shaft-M';root.add(shaftBearing);
 // Lugs join the lever pivot and the spring anchor to the casing.
 const lug=(x,y0,y1,z0,z1,role)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(.16,y1-y0,z1-z0),material);o.position.set(x,(y0+y1)/2,(z0+z1)/2);o.userData.role=role;root.add(o);return o;};
 // Pass 92: the pivot lug is one extrusion whose top is a round eye
 // concentric with lever N's pin (r .13 round the .07 pin), not a square
 // end cut at the pin's axis.
 {const px=b.leverPivotBearing.position.x,py=b.leverPivotBearing.position.y,shape=new THREE.Shape();
  shape.moveTo(px-.08,3.40);shape.lineTo(px+.08,3.40);shape.lineTo(px+.08,py-Math.sqrt(.13*.13-.08*.08));
  shape.absarc(px,py,.13,-Math.acos(.08/.13),Math.PI+Math.acos(.08/.13),false);shape.lineTo(px-.08,3.40);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.4,bevelEnabled:false,curveSegments:48});geometry.translate(0,0,-.2);
  const o=new THREE.Mesh(geometry,material);o.userData.role='casing-lug-carrying-lever-N-pivot';root.add(o);}
 const eye=b.springLowerEye.position;const spur=new THREE.Mesh(new THREE.BoxGeometry(.3,.12,.5),material);spur.position.set(eye.x+.12,eye.y-.18,.08);spur.userData.role='casing-lug-anchoring-spring-L';root.add(spur);
 // No white indices or index teeth are drawn.
 for(const o of[b.inputShaftIndex,...b.rotorFaceIndexes,b.rotorIndexBead,b.engineInputIndex,b.valveRodIndex])o.removeFromParent();
 for(const gearAssembly of[b.crownGear,b.pinion,b.carrierDriveGear,b.engineInputGear]){const t=gearAssembly.userData.toothMeshes;t[0].material=t[1].material;}
 const attached=o=>{for(let n=o;n;n=n.parent)if(n===root)return true;return false;};
 p.pairs=p.pairs.filter(pair=>pair.every(attached));
 p.pairs.push([b.verticalCarrierShaft,shell],[b.engineInputShaft,shaftBearing]);
}
export function correctAndersonGovernor(root,update){
 const d=root.userData,b=d.blocks,g=d.geometry,p={pairs:[],gearPairs:[]};
 const constant=g.sourceInputShaftPhase-5*g.sourceCarrierYaw;
 gear(b.crownGear,{teeth:60,radius:2.55,outer:.51,height:.13,bore:1.90,sign:-1,axis:Y,color:PALETTE.frame});
 gear(b.pinion,{teeth:12,radius:.51,outer:2.55,height:.13,bore:.079,sign:-1,phase:Math.PI/2-constant+Math.PI/12,axis:new THREE.Vector3(1,0,0),color:PALETTE.driver});
 gear(b.carrierDriveGear,{teeth:18,radius:.62,outer:.62,height:.12,bore:.126,axis:Y,color:PALETTE.driver});b.carrierDriveGear.position.y=-2.79;
 gear(b.engineInputGear,{teeth:18,radius:.62,outer:.62,height:.12,bore:.136,sign:-1,phase:Math.PI/9,axis:Z,color:PALETTE.driven});
 b.crownGear.userData.body.userData.role='stationary-toothed-circle-G-body';
 p.gearPairs=[[b.pinion,b.crownGear],[b.engineInputGear,b.carrierDriveGear]];
 replace(b.radialCarrierBeam,new THREE.BoxGeometry(3.1,.18,.26));b.radialCarrierBeam.position.set(-.15,-1.47,0);
 b.hingePins.forEach(pin=>{replace(pin,new THREE.CylinderGeometry(.073,.073,.26,48));pin.position.z=pin.userData.side*.63;});
 const hingeRing=new THREE.Mesh(boredLatheGeometry([{radial:.56,axial:-.04},{radial:.56,axial:.04}],.49,96),b.hingeBearings[0].material);hingeRing.rotation.z=Math.PI/2;hingeRing.userData.role='open-hinge-frame-around-Cardan-joint';b.tiltGroup.add(hingeRing);
 const neck=b.outputRotor.children.find(o=>o.userData.role==='output-yoke-neck-rigid-with-piece-B');
 const inputNeck=b.inputRotor.children.find(o=>o.userData.role==='input-yoke-neck-of-universal-joint');
 replace(neck,new THREE.CylinderGeometry(.17,.17,.28,48));neck.position.x=.31;
 replace(inputNeck,new THREE.CylinderGeometry(.18,.18,.24,48));inputNeck.position.x=-.33;
 replace(b.outputShaft,new THREE.CylinderGeometry(.075,.075,1.62,48));b.outputShaft.position.x=.99;
 const inputLength=g.jointLocal.x-g.pinionCenterLocal.x;replace(b.inputShaft,new THREE.CylinderGeometry(.075,.075,inputLength-.18,48));b.inputShaft.position.x=-(inputLength+.18)/2;
 const neckBearing=new THREE.Mesh(boredLatheGeometry([{radial:.235,axial:-.04},{radial:.235,axial:.04}],.176,64),b.hingeBearings[0].material);neckBearing.rotation.z=Math.PI/2;neckBearing.position.x=.40;neckBearing.userData.role='tilting-journal-for-output-yoke-neck';b.tiltGroup.add(neckBearing);
 // Each spoke doglegs outside the output yoke's swept circle before turning in to the journal.
 const hingeSpokes=[-1,1].flatMap(side=>[[new THREE.Vector3(0,0,side*.53),new THREE.Vector3(.36,0,side*.45)],[new THREE.Vector3(.36,0,side*.45),new THREE.Vector3(.40,0,side*.21)]].map(([a,c])=>{const spoke=makeBeam(a,c,{color:PALETTE.driver,thickness:.07,depth:.07});b.tiltGroup.add(spoke);return spoke;}));
 p.pairs.push([neck,neckBearing],[b.spiderHub,inputNeck],[b.spiderHub,neck],[b.inputShaft,b.spiderHub],[b.outputShaft,b.spiderHub]);
 for(const moving of[b.spiderInputTrunnion,b.spiderOutputTrunnion,...b.inputYokeEyes,...b.outputYokeEyes,b.outputShaft,b.rotorDisk])p.pairs.push([moving,hingeRing]);
 const coil=b.springL.children[0],path=new class extends THREE.Curve{constructor(){super();this.length=4;this.arcLengthDivisions=512;}getPoint(t,p=new THREE.Vector3()){const r=(t===0||t===1)?0:.105*Math.sin(Math.PI*t)**.35,a=t*12*2*Math.PI;return p.set(r*Math.cos(a),t*this.length,r*Math.sin(a));}}();
 replace(coil,new THREE.TubeGeometry(path,192,.027,8,false));const refill=tubePathUpdater(coil.geometry);
 b.springL.userData.setEndpoints=(start,end)=>{const delta=end.clone().sub(start);b.springL.position.copy(start);b.springL.quaternion.setFromUnitVectors(Y,delta.clone().normalize());b.springL.scale.setScalar(1);path.length=delta.length();path.updateArcLengths();refill(path);};
 b.hingeBearings.forEach((h,i)=>{bore(h,.17,.18,.079);p.pairs.push([b.hingePins[i],h]);});
 bore(b.outputBearingCollar,.19,.26,.081);p.pairs.push([b.outputShaft,b.outputBearingCollar]);
 bore(b.valveRodGuide,.14,.34,.081);p.pairs.push([b.valveRodD,b.valveRodGuide]);
 // The old lower standard is an unported block through both rotating shafts.
 const posts=[];for(const x of[-.25,.25])for(const z of[-.36,.36])posts.push(new THREE.BoxGeometry(.10,1.24,.10).translate(x,0,z));
 replace(b.lowerStandard,mergeGeometries(posts));posts.forEach(g=>g.dispose());
 const cap=root.children.find(o=>o.userData.role==='upper-bearing-cap-on-drive-standard');if(cap)bore(cap,.49,.18,.126);
 p.pairs.push([b.verticalCarrierShaft,b.lowerStandard],[b.engineInputShaft,b.lowerStandard]);if(cap)p.pairs.push([b.verticalCarrierShaft,cap]);
 for(const moving of[b.rotorDisk,b.outputShaft])for(const fixed of[b.radialCarrierBeam,...b.carrierCageArms,...b.hingeBearings,...b.hingePins,...b.inputYokeEyes,b.spiderInputTrunnion,b.spiderOutputTrunnion])p.pairs.push([moving,fixed]);
 castCasing(root,b,p);
 d.governorWorkingParts=p;
 finish(root,'The 60:12 fixed-circle drive and single Cardan joint determine wheel spin. Tilt is prescribed from a quasi-static spring/gyroscopic torque balance. Transient governing, friction, stability and the spring load under real engine disturbances are not simulated.');
 // Brown draws the casing interior light; keep its own shade off it.
 for(const o of root.children)if(/^fixed-cast-(?:casing|foot)/.test(o.userData.role??''))o.receiveShadow=false;
 const bounds=new THREE.Box3();for(let i=0;i<=32;i++){update(g.cyclePeriod*i/32);root.updateMatrixWorld(true);bounds.union(new THREE.Box3().setFromObject(root,true));}d.cameraFitBounds=bounds.expandByScalar(.18);update(0);
}
