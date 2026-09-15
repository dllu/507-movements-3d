import * as THREE from 'three';
import {makeGearedCrankFrame} from './geared-crank-frame.js';
import {gearedCrankSource as g,sourcePoint} from './geared-crank-source.js';
import {makeGear,matte,PALETTE,markShadows} from './primitives.js';
import {plate,poly,capsule,ring,disk} from './finite-plate-geometry.js';
import {disposeObject3D} from './dispose-model.js';

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
 const gear=(name,teeth,radius,body,phase,opening)=>{
  const nominal=.085*1.48,template=makeGear({teeth,radius,depth:.24,addendum:nominal*.55,dedendum:nominal*.65});
  const shape=template.userData.rotor.children[0].geometry.parameters.shapes.clone();disposeObject3D(template);
  const hole=new THREE.Path();hole.absarc(0,0,opening,0,2*Math.PI,true);shape.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:true,bevelSize:.008,bevelOffset:-.008,bevelThickness:.008,bevelSegments:1,curveSegments:64});
  geometry.translate(0,0,-.32);
  add(name,geometry,body,body===blocks.pinion?'driver':'driven').rotation.z=phase;
 };
 gear('large-involute-rim',48,4.08,blocks.drive,Math.PI/48,3.64);
 gear('involute-pinion',12,1.02,blocks.pinion,0,.183);
 add('large-bored-hub',ring(.183,.53,-.38,.16,96),blocks.drive,'driven');
 add('gear-shaft-retainer',disk(.42,.17,.185,96),blocks.fixed,'brass');
 add('pinion-bored-hub',ring(.183,.25,-.38,.12,96),blocks.pinion,'driver');
 for(let i=0;i<8;i++)add('gear-spoke-'+i,plate(capsule([.34,0],[3.67,0],.055,24),-.28,-.12).rotateZ(Math.PI/48+i*Math.PI/4),blocks.drive,'driven');
 add('pinion-shaft',disk(.18,-.8,.18,64).translate(-5.1,0,0),blocks.fixed,'ink');
 const panel=points=>poly(points.map(p=>sourcePoint(p).toArray()));
 add('left-frame-panel',plate(panel([[32,215],[85,215],[101,240],[128,255],[139,280],[133,323],[99,340],[85,359],[32,359]]),-.85,-.59),blocks.fixed,'frame');
 add('right-frame-panel',plate(panel([[414,252],[435,238],[457,215],[500,215],[500,357],[457,357],[435,337],[414,323]]),-.85,-.59),blocks.fixed,'frame');
 add('rear-frame-rail',plate(capsule([-5.4,0],[6.3,0],.13,32),-.85,-.59),blocks.fixed,'frame');
 const pivot=sourcePoint(g.pivot),joint=sourcePoint(g.joint),wrist=sourcePoint(g.eccentric);
 for(const [name,r,low,high,x,y] of [
  ['rocker-pivot',.16,-.70,.58,pivot.x,pivot.y],
  ['frame-joint-pin',.12,.195,.58,joint.x-pivot.x,joint.y-pivot.y],
  ['eccentric-pin',.12,.12,.37,wrist.x,wrist.y],
 ]){parts[name].geometry.dispose();parts[name].geometry=disk(r,low,high,64).translate(x,y,0);}
 const update=time=>{const state=v.update(time);blocks.pinion.rotation.z=Math.PI*time;root.updateMatrixWorld(true);root.userData.state=state;};
 const bounds=new THREE.Box3();for(let i=0;i<=128;i++){update(8*i/128);bounds.union(new THREE.Box3().setFromObject(root,true));}bounds.expandByScalar(.03);
 Object.assign(root.userData,{mechanism:'spur-geared-oblong-frame-crank-rocker',fidelity:'authored',simulationBackend:'analytic',reconstructionStatus:'rebuilt',supportsRestart:true,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
  animationTiming:{authoredCyclePeriod:8,displayCycleDuration:8,playbackTimeScale:1},
  reconstructionNote:'The spur gears drive an eccentric pin and a short crank connected to the oblong rocking frame. The upper joint is shifted 14 pixels from the drawing to permit a complete input revolution. Frame attachment, rear supports and axial depths are reconstructed; the oblong is treated as a structural member, not a working groove.'});
 markShadows(root);update(0);
 return {root,update,reset:()=>update(0),focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.05,.03,15),dispose:v.dispose};
}
