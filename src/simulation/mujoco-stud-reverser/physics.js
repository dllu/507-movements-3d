import * as THREE from 'three';
import {createAuthoredStudDriveMovement} from '../authored-stud-drives.js';
import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';

export function makeStudReverserPhysics(mujoco,{timestep=.00025,gravity=9.81,barFriction=.5,barDamping=1,leverDamping=.02,outputLengthScale=1,contact=true}={}){
 const visual=createAuthoredStudDriveMovement({id:153}),u=visual.root.userData,b=u.blocks,g=u.geometry,initial=u.stateAtTime(0);
 b.outputArm.userData.blocks.beam.scale.x=outputLengthScale;
 b.outputArm.userData.blocks.beam.position.x*=outputLengthScale;
 b.outputArm.userData.blocks.endCap.position.x*=outputLengthScale;
 const groups=new Map([[b.diskRotor,'disk'],[b.slidingBar,'bar'],[b.lever,'lever']]),parts={},families={};
 visual.root.updateMatrixWorld(true);
 for(const [group,family] of groups)group.traverse(mesh=>{if(!mesh.isMesh)return;const name='mass'+Object.keys(parts).length;parts[name]=new THREE.Mesh(mesh.geometry.clone().applyMatrix4(group.matrixWorld.clone().invert().multiply(mesh.matrixWorld)));families[name]=family;});
 const mass=Object.fromEntries(['disk','bar','lever'].map(n=>[n,rigidFamilyInertia(parts,families,n)])),density=1/mass.bar.volume;
 for(const mesh of Object.values(parts))mesh.geometry.dispose();
 const inertia=name=>{const m=mass[name];return `<inertial pos="${m.centroid.join(' ')}" mass="${m.volume*density}" fullinertia="${m.inertia.map(x=>x*density).join(' ')}"/>`;};
 const assets=[],geoms={disk:[],bar:[],lever:[]};
 const add=(name,mesh,group,family,type,affinity)=>{
  const vertices=new Map();mesh.traverse(part=>{if(!part.isMesh)return;const geometry=part.geometry.clone().applyMatrix4(group.matrixWorld.clone().invert().multiply(part.matrixWorld)),p=geometry.attributes.position;for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)];vertices.set(v.join(','),v);}geometry.dispose();});
  assets.push(`<mesh name="${name}" vertex="${[...vertices.values()].flat().join(' ')}"/>`);
  geoms[family].push(`<geom name="${name}" type="mesh" mesh="${name}" contype="${contact?type:0}" conaffinity="${contact?affinity:0}"/>`);
 };
 b.pinAssemblies.forEach((a,i)=>add('disk-pin-'+i,a.userData.blocks.pin,b.diskRotor,'disk',1,6));
 add('bar-lug',b.undersideLug,b.slidingBar,'bar',2,1);
 add('bar-pin',b.barFrontStud,b.slidingBar,'bar',16,8);
 add('lever-input',b.inputArm,b.lever,'lever',4,1);
 add('lever-output',b.outputArm,b.lever,'lever',8,16);
 const angle=initial.lever.worldAngle,period=g.diskPeriod,speed=-g.diskScreenAngularSpeed;
 const xml=`<mujoco model="153 passive impact prototype"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 -${gravity} 0" integrator="implicitfast" iterations="100" tolerance="1e-10"><flag multiccd="disable"/></option>
 <default><geom friction="0 0 0" condim="1" solref=".002 1" solimp=".999 .9999 .0001"/></default><asset>${assets.join('')}</asset><worldbody>
 <body name="disk"><joint name="disk" axis="0 0 1"/>${inertia('disk')}${geoms.disk.join('')}</body>
 <body name="bar"><joint name="bar" type="slide" axis="1 0 0" frictionloss="${barFriction}" damping="${barDamping}"/>${inertia('bar')}${geoms.bar.join('')}</body>
 <body name="lever" pos="${g.leverPivot.toArray().join(' ')}"><joint name="lever" axis="0 0 1" damping="${leverDamping}" limited="true" range="${angle} 6.283185307179586" solreflimit=".002 1"/>${inertia('lever')}${geoms.lever.join('')}</body>
 </worldbody><actuator><position joint="disk" kp="10000" kv="100"/></actuator></mujoco>`;
 const initialDisk=-initial.driverScreenAngle;
 const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qpos.set([initialDisk,0,angle]);data.qvel[0]=speed;},beforeStep:({data,time})=>{data.ctrl[0]=initialDisk+speed*time+.01*speed;}});
 disposeObject3D(visual.root);
 return Object.assign(physics,{description:{period,timestep,gravity,barFriction,barDamping,leverDamping,outputLengthScale,contact,mass,density,initialDisk,initialLever:angle,speed,assumptions:'Only disk is driven. Bar and lever move through frictionless finite contact. Gravity resets the lever against an inferred lower stop; bar guide friction and damping are inferred. Legacy overlapping decorative mesh volumes are provisional mass estimates. Finite bearings and nonworking collision pairs are not qualified.'},state:()=>({time:physics.data.time,qpos:Array.from(physics.data.qpos),qvel:Array.from(physics.data.qvel)})});
}
