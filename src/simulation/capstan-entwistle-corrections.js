import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const bore=(mesh,radius,outer=null)=>{const p=mesh.geometry.parameters;replace(mesh,boredLatheGeometry([{axial:-p.height/2,radial:outer??p.radiusBottom},{axial:p.height/2,radial:outer??p.radiusTop}],radius,64));mesh.userData.boreRadius=radius;};
function spur(gear,radius){
 const rotor=gear.userData.rotor,body=rotor.children[0],p=body.geometry.parameters,shape=p.shapes.clone(),hole=new THREE.Path();
 hole.absarc(0,0,radius,0,2*Math.PI,true);shape.holes.push(hole);
 replace(body,new THREE.ExtrudeGeometry(shape,{...p.options,curveSegments:48}).translate(0,0,-p.options.depth/2));body.userData.boreRadius=radius;
 bore(rotor.children[1],radius,Math.max(radius+.065,.171));
 const index=rotor.children[3],start=Math.max(radius+.07,.22),end=.70;
 replace(index,new THREE.BoxGeometry(end-start,.055,.024));index.position.x=(start+end)/2;
}
export function correctCapstanWheelwork(root){
 const b=root.userData.blocks,g=root.userData.geometry;
 // Brown draws only the base wheel-work. Keep the inferred upper capstan and
 // selectors in the analytic model, but omit them from this source view.
 const keep=new Set([b.sunGear,b.spindle]);
 for(const o of b.spindleRotor.children)if(!keep.has(o))o.visible=false;
 for(const o of b.barrelRotor.children)if(o!==b.annulusGear&&o!==b.annulusIndex)o.visible=false;
 b.fixedFrame.visible=false;
 for(const {hole,lug}of b.carrierLugs){hole.visible=false;lug.visible=false;}
 b.carrierIndex.visible=false;
 const hub=b.carrierRotor.children.find(o=>o.userData.role==='planet-carrier-central-web-hub');
 replace(hub,boredLatheGeometry([{axial:-.075,radial:.52},{axial:.075,radial:.52}],.232,64));hub.position.y=.405;
 const centers=g.planetAngles.map(a=>[g.planetCenterRadius*Math.cos(a),g.planetCenterRadius*Math.sin(a)]);
 const webs=[poly(circle([0,0],1.18,72)),...centers.map(c=>poly(circle(c,.75,48)))];
 centers.forEach(([x,z])=>{const length=Math.hypot(x,z),vx=-z/length*.46,vz=x/length*.46;webs.push(poly([[vx,vz],[x+vx,z+vz],[x-vx,z-vz],[-vx,-vz]]));});
 const web=clip.difference(clip.union(...webs),poly(circle([0,0],.232,64)),...centers.map(c=>poly(circle(c,.112,48))));
 replace(b.carrierArms[0],plate(web,-.07,.07).rotateX(Math.PI/2));b.carrierArms[0].position.set(0,.40,0);b.carrierArms[0].rotation.set(0,0,0);
 b.carrierArms[0].userData.role='three-lobed-bored-common-planet-carrier';
 b.carrierArms.slice(1).forEach(arm=>{arm.visible=false;});
 replace(b.spindle,new THREE.CylinderGeometry(.23,.23,1.08,48));b.spindle.position.y=.57;
 spur(b.sunGear,.232);b.planets.forEach(p=>spur(p,.112));
 b.planetStuds=b.planets.map(p=>{const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.72,48),b.spindle.material);shaft.position.set(p.position.x,.70,p.position.z);shaft.userData.role='carrier-fixed-planet-journal';b.carrierRotor.add(shaft);return shaft;});
 root.userData.hideGround=true;
 root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-3.1,.25,-3.1),new THREE.Vector3(3.1,1.14,3.1));
 root.userData.cameraDirection=new THREE.Vector3(1,12,3);
 root.rotation.y=-Math.PI/2;
 root.userData.cameraDistanceScale=1;
 root.userData.minimumDisplayCycleSeconds=12;
 root.userData.displayTreatment.mechanicalGeometryOmitted=true;
 root.userData.displayTreatment.function='Source plan view of the base wheel-work; inferred upper capstan and selector hardware are omitted.';
 root.userData.reconstructionNote='Base wheel-work: locked input and barrel turn together; with the carrier held, the barrel reverses at one-third input speed. Mode changes occur at rest. The drumhead and locking hardware are omitted; tooth counts and shaft fits are reconstructed.';
 root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.fog=false;});
}
export function correctEntwistleGearing(root){
 const b=root.userData.blocks;
 bore(b.carrierCollar,.087);
 const planetHub=b.planetGearB.userData.rotor.children.at(-3),hubCenter=planetHub.position.z;
 replace(planetHub,boredLatheGeometry([{axial:.32-hubCenter,radial:.169},{axial:1.38-hubCenter,radial:.169}],.074,64).rotateX(Math.PI/2));
 planetHub.userData.boreRadius=.074;
 // The independently turning output index must not close the shaft opening.
 replace(b.outputIndex,new THREE.BoxGeometry(.075,.58,.065));b.outputIndex.position.y=.425;
 for(const bearing of b.bearings){
  replace(bearing,boredLatheGeometry([{axial:-.065,radial:.25},{axial:.065,radial:.25}],.087,64).rotateX(Math.PI/2));
  bearing.userData.boreRadius=.087;
 }
 for(const marker of b.contactMarkers)marker.visible=false;
 // Preserve the source bedplate, but remove its invented broad rear platform.
 replace(b.base,new THREE.BoxGeometry(7.9,.24,.85));
 const lower=new THREE.Vector3(2.64,-1.88,0),upper=new THREE.Vector3(2.64,.62,-.34);
 b.rightStandard.userData.setEndpoints(lower,upper);b.rightStandard.userData.foot=lower;
 root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=6;
 root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-4.05,-2.14,-2.18),new THREE.Vector3(4.05,2.80,2.18));
 root.userData.cameraDistanceScale=1;
 root.userData.reconstructionNote='The carried pinion rolls around fixed A and drives C at twice the shaft speed. Equal bevel gears and their common apex follow the caption; tooth sections, shaft fits and support depths are reconstructed.';
 root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.fog=false;});
}
