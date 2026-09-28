import * as THREE from 'three';
import {makeGearedCrankFrame} from './geared-crank-frame.js';
import {gearedCrankSource as g,sourcePoint} from './geared-crank-source.js';
import {makeGear,matte,PALETTE,markShadows} from './primitives.js';
import {plate,poly,capsule,ring,disk} from './finite-plate-geometry.js';
import {disposeObject3D} from './dispose-model.js';
import {spokedWheelGeometry} from './spoked-wheel.js';

export function makeGearedCrank(){
 const v=makeGearedCrankFrame(),{root}=v,{parts,families,blocks}=root.userData;
 const materials=Object.fromEntries(['driver','driven','frame','brass','ink'].map(k=>{const m=matte(PALETTE[k],{roughness:.65,metalness:.14});m.fog=false;return[k,m];}));
 const oldMaterials=new Set();
 for(const [name,mesh] of Object.entries(parts)){
  oldMaterials.add(mesh.material);
  mesh.material=materials[name.includes('pin')||name.includes('pivot')?'brass':families[name]==='fixed'?'ink':families[name]==='drive'?'driven':'driver'];
 }
 for(const m of oldMaterials)m.dispose();
 const add=(name,geometry,body,color)=>{const mesh=new THREE.Mesh(geometry,materials[color]);mesh.name=name;body.add(mesh);parts[name]=mesh;families[name]=body.name;return mesh;};
 blocks.pinion=new THREE.Group();blocks.pinion.name='pinion';blocks.pinion.position.x=-5.1;root.add(blocks.pinion);
 const toothOutline=(teeth,radius)=>{
  const nominal=.085*1.48,template=makeGear({teeth,radius,depth:.24,addendum:nominal*.55,dedendum:nominal*.65});
  const shape=template.userData.rotor.children[0].geometry.parameters.shapes.clone();disposeObject3D(template);
  const points=[];for(const p of shape.getPoints()){const last=points.at(-1);if(!last||Math.hypot(p.x-last[0],p.y-last[1])>1e-9)points.push([p.x,p.y]);}
  if(Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-9)points.pop();
  return {shape,points};
 };
 {
  // Pinion: a solid involute plate bored for its hub.
  const {shape}=toothOutline(12,1.02),hole=new THREE.Path();hole.absarc(0,0,.183,0,2*Math.PI,true);shape.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:true,bevelSize:.008,bevelOffset:-.008,bevelThickness:.008,bevelSegments:1,curveSegments:64});
  geometry.translate(0,0,-.32);add('involute-pinion',geometry,blocks.pinion,'driver');
 }
 {
  // Large gear: Brown's toothed rim and eight broad spokes are one spoked
  // plate (the shared spoked-wheel builder), 0.24 deep like the rim; the
  // spokes are about as wide as he draws them (0.26, was 0.11 bars).
  const {points}=toothOutline(48,4.08),rotation=Math.PI/48;
  const outline=points.map(([x,y])=>[x*Math.cos(rotation)-y*Math.sin(rotation),x*Math.sin(rotation)+y*Math.cos(rotation)]);
  const geometry=spokedWheelGeometry({outline,spokes:8,phase:rotation,rimInnerRadius:3.64,spokeWidth:.30,spokeTipWidth:.24,
   hubRadius:.62,rimFillet:.12,boreRadius:.34,thickness:.24,arcSegments:384});
  geometry.translate(0,0,-.20);geometry.userData.toothOutline=outline;
  add('large-spoked-gear',geometry,blocks.drive,'driven');
 }
 add('large-bored-hub',ring(.183,.53,-.38,.16,96),blocks.drive,'driven');
 add('gear-shaft-retainer',disk(.42,.17,.185,96),blocks.fixed,'brass');
 add('pinion-bored-hub',ring(.183,.25,-.38,.12,96),blocks.pinion,'driver');
 add('pinion-shaft',disk(.18,-.8,.18,64).translate(-5.1,0,0),blocks.fixed,'ink');
 const panel=points=>poly(points.map(p=>sourcePoint(p).toArray()));
 add('left-frame-panel',plate(panel([[32,215],[85,215],[101,240],[128,255],[139,280],[133,323],[99,340],[85,359],[32,359]]),-.85,-.59),blocks.fixed,'frame');
 add('right-frame-panel',plate(panel([[414,252],[435,238],[457,215],[500,215],[500,357],[457,357],[435,337],[414,323]]),-.85,-.59),blocks.fixed,'frame');
 add('rear-frame-rail',plate(capsule([-5.4,0],[6.3,0],.13,32),-.85,-.59),blocks.fixed,'frame');
 const pivot=sourcePoint(g.pivot);
 parts['rocker-pivot'].geometry.dispose();parts['rocker-pivot'].geometry=disk(.16,-.70,.58,64).translate(pivot.x,pivot.y,0);
 const update=time=>{const state=v.update(time);blocks.pinion.rotation.z=Math.PI*time;root.updateMatrixWorld(true);root.userData.state=state;};
 const bounds=new THREE.Box3();for(let i=0;i<=128;i++){update(8*i/128);bounds.union(new THREE.Box3().setFromObject(root,true));}bounds.expandByScalar(.03);
 Object.assign(root.userData,{mechanism:'spur-geared-oblong-groove-lever-and-axle-crank',fidelity:'authored',simulationBackend:'analytic',reconstructionStatus:'rebuilt',supportsRestart:true,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
  animationTiming:{authoredCyclePeriod:8,displayCycleDuration:8,playbackTimeScale:1},
  reconstructionNote:'The oblong is a groove on the large gear\'s face. The pin on the long lever runs round it as the gears turn, so the lever, pivoted on the right-hand bracket, rocks back and forth. Brown\'s short arm is a link from that pin to the eye of a crank pivoted on the large gear\'s axle, which the lever swings to and fro ("alternate circular motion of the crank attached to the larger gear"). The crank arm, its place on the axle and the link and crank lengths (1.75, lengthened so the link reaches the pin\'s whole swing) are reconstructed, as are groove depth, walls, rear supports and axial depths.'});
 markShadows(root);update(0);
 return {root,update,reset:()=>update(0),focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.05,.03,15),dispose:v.dispose};
}
