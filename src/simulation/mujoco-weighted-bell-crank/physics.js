import * as THREE from 'three';
import {makeSupportedWeightedBellCrank} from './geometry.js';
import {createAuthoredStudDriveMovement} from '../authored-stud-drives.js';
import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';

/** Diagnostic only: source working solids and a passive, tension-only wrapped cord. */
export function makeWeightedBellCrankPhysics(mujoco, {timestep=.00025, contact=true, gravity=9.81, restLimit=false, supported=false}={}) {
  const visual=supported?makeSupportedWeightedBellCrank():createAuthoredStudDriveMovement({id:154}), {blocks:b,geometry:g}=visual.root.userData;
  const initial=visual.root.userData.stateAtTime(0), groups={disk:b.diskRotor,lever:b.lever,weight:b.weight};
  visual.root.updateMatrixWorld(true);
  const parts={},families={};
  for(const [family,group] of Object.entries(groups)) group.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const name='mass'+Object.keys(parts).length;
    parts[name]=new THREE.Mesh(mesh.geometry.clone().applyMatrix4(group.matrixWorld.clone().invert().multiply(mesh.matrixWorld)));
    families[name]=family;
  });
  const mass=Object.fromEntries(Object.keys(groups).map(name=>[name,rigidFamilyInertia(parts,families,name)]));
  for(const mesh of Object.values(parts))mesh.geometry.dispose();
  const density=1/mass.weight.volume;
  const inertia=name=>{const m=mass[name];return `<inertial pos="${m.centroid.join(' ')}" mass="${m.volume*density}" fullinertia="${m.inertia.map(x=>x*density).join(' ')}"/>`;};
  const assets=[],geoms={disk:[],lever:[],fixed:[]};
  const add=(name,object,family,type,affinity)=>{
    const vertices=new Map(),group=family==='fixed'?b.fixedFrame:groups[family];
    object.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const geometry=mesh.geometry.clone().applyMatrix4(group.matrixWorld.clone().invert().multiply(mesh.matrixWorld)),p=geometry.attributes.position;
      for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)];vertices.set(v.join(','),v);}
      geometry.dispose();
    });
    assets.push(`<mesh name="${name}" vertex="${[...vertices.values()].flat().join(' ')}"/>`);
    geoms[family].push(`<geom name="${name}" type="mesh" mesh="${name}" contype="${contact?type:0}" conaffinity="${contact?affinity:0}"/>`);
  };
  b.pinAssemblies.forEach((assembly,i)=>add('stud-'+i,assembly.userData.blocks.pin,'disk',1,2));
  add('input-arm',b.inputArm,'lever',2,5);
  if(supported)add('rest-stop',b.leverStop,'fixed',4,2);
  const eye=b.lever.worldToLocal(b.outputEye.getWorldPosition(new THREE.Vector3()));
  const pulley=g.pulleyCenter,cordLength=initial.cord.totalLength,angle=initial.lever.worldAngle,speed=-g.diskScreenAngularSpeed;
  const xml=`<mujoco model="154 passive weighted cord diagnostic"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -${gravity} 0" integrator="implicitfast" iterations="100" tolerance="1e-10"><flag multiccd="disable"/></option>
    <default><geom friction="0 0 0" condim="1" solref=".002 1" solimp=".999 .9999 .0001"/><site size=".01"/></default>
    <asset>${assets.join('')}</asset><worldbody>${geoms.fixed.join('')}
    <geom name="pulley-wrap" type="cylinder" size="${g.pulleyPitchRadius} .1" pos="${pulley.toArray().join(' ')}" contype="0" conaffinity="0"/>
    <site name="upper-wrap" pos="${pulley.x} ${pulley.y+g.pulleyPitchRadius+.1} ${pulley.z}"/>
    <body name="disk"><joint name="disk" axis="0 0 1"/>${inertia('disk')}${geoms.disk.join('')}</body>
    <body name="lever" pos="${g.leverPivot.toArray().join(' ')}"><joint name="lever" axis="0 0 1" damping=".02" ${restLimit&&!supported?`limited="true" range="${angle} 0"`:''}/>${inertia('lever')}${geoms.lever.join('')}<site name="lever-eye" pos="${eye.toArray().join(' ')}"/></body>
    <body name="weight" pos="${initial.weight.center.toArray().join(' ')}"><joint name="weight" type="slide" axis="0 1 0" damping=".02"/>${inertia('weight')}<site name="weight-eye" pos="0 ${initial.weight.attachment.y-initial.weight.center.y} 0"/></body>
    </worldbody><tendon><spatial name="cord" limited="true" range="0 ${cordLength}" solreflimit=".002 1" solimplimit=".999 .9999 .0001"><site site="lever-eye"/><geom geom="pulley-wrap" sidesite="upper-wrap"/><site site="weight-eye"/></spatial></tendon>
    <actuator><position joint="disk" kp="10000" kv="100"/></actuator></mujoco>`;
  let physics;
  try {physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qpos.set([0,angle,0]);data.qvel[0]=speed;},beforeStep:({data,time})=>{data.ctrl[0]=speed*(time+.01);}});}
  finally {disposeObject3D(visual.root);}
  return Object.assign(physics,{description:{period:g.diskPeriod,timestep,gravity,contact,restLimit,supported,cordLength,mass,density,initialLever:angle,speed,assumptions:supported?'Candidate reconstruction. Only the disk is driven; the elbow returns under cord tension to a rendered contact-active stop. The weight has an ideal vertical guide; the massless cord wraps a fixed frictionless cylinder with a unilateral length limit. Bores, connected fittings, stop and damping are inferred; common-density moving mesh inertias normalize weight mass to one. Pulley inertia is neglected. Full assembly and timestep qualification are external.':'Diagnostic only. One driven disk, passive elbow and vertically guided weight, frictionless contact and tension-only cord over an ideal fixed pulley. Legacy decorative volumes overlap and masses are provisional. Optional joint rest limit is diagnostic, not a rendered stop. Nonworking assembly collisions and source fidelity remain unqualified.'},state:()=>({time:physics.data.time,qpos:Array.from(physics.data.qpos),qvel:Array.from(physics.data.qvel),cordLength:physics.data.ten_length[0]})});
}
