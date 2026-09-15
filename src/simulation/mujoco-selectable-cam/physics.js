import * as THREE from 'three';
import {makeSelectableCamValve} from '../selectable-cam-valve.js';
import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

export function makeSelectableCamPhysics(mujoco,{ticksPerPeriod=60000,gravity=9.81,multiContact=false,nativeCCD=false}={}){
 const visual=makeSelectableCamValve(),u=visual.root.userData,g=u.geometry,b=u.blocks;
 const period=g.demonstrationPeriod,drive=u.stateAtTime,initial=drive(0),v=u.valveGeometry;
 const groups=new Map([[b.camRotor,'shaft'],[b.slidingCarrier,'carrier'],[b.lever,'lever'],[b.followerRoller.rotor,'roller'],[u.valveBodies.rod,'rod'],[u.valveBodies.slider,'slider']]);
 const parts={},families={};
 visual.root.updateMatrixWorld(true);
 visual.root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.material.opacity===0)return;
  let parent=mesh,body;while(parent&&!body){if(groups.has(parent))body=parent;else parent=parent.parent;}
  if(!body)return;
  const geometry=mesh.geometry.clone().applyMatrix4(body.matrixWorld.clone().invert().multiply(mesh.matrixWorld));
  const name='part'+Object.keys(parts).length;parts[name]=new THREE.Mesh(geometry);families[name]=groups.get(body);
 });
 const mass=Object.fromEntries([...groups.values()].map(name=>[name,rigidFamilyInertia(parts,families,name)]));
 for(const mesh of Object.values(parts))mesh.geometry.dispose();visual.dispose();
 const density=1/mass.lever.volume;
 const inertial=name=>{const m=mass[name];return `<inertial pos="${m.centroid.join(' ')}" mass="${m.volume*density}" fullinertia="${m.inertia.map(x=>x*density).join(' ')}"/>`;};
 const assets=[],cams=[];
 for(const c of g.configs){
  const vertices=Array.from({length:192},(_,i)=>{const a=i*2*Math.PI/192,r=c.baseRadius+c.lift*(1+Math.cos(a))/2;return [-c.camDepth/2,c.camDepth/2].flatMap(z=>[r*Math.cos(a+c.phaseOffset),r*Math.sin(a+c.phaseOffset),z]);}).flat();
  assets.push(`<mesh name="cam${c.index}" vertex="${vertices.join(' ')}"/>`);
  cams.push(`<geom name="cam${c.index}" type="mesh" mesh="cam${c.index}" pos="0 0 ${c.localPlaneZ}" contype="1" conaffinity="2"/>`);
 }
 const xml=`<mujoco model="150 passive selectable cam prototype"><compiler angle="radian" inertiafromgeom="false"/>
 <option timestep="${period/ticksPerPeriod}" gravity="0 -${gravity} 0" integrator="implicitfast" iterations="100" tolerance="1e-10" cone="elliptic"><flag nativeccd="${nativeCCD?'enable':'disable'}" multiccd="${multiContact?'enable':'disable'}"/></option>
 <default><geom friction=".15 .001 .0001" condim="3" solref=".004 1" solimp=".999 .9999 .0001"/></default>
 <asset>${assets.join('')}</asset><worldbody>
 <body name="shaft"><joint name="shaft" type="hinge" axis="0 0 1"/>${inertial('shaft')}
  <body name="carrier"><joint name="carrier" type="slide" axis="0 0 1"/>${inertial('carrier')}${cams.join('')}
   <geom name="common-heel" type="cylinder" size="${g.baseRadius} ${g.stackLength/2}" contype="1" conaffinity="2"/>
  </body></body>
 <body name="lever" pos="${g.leverPivot.x} ${g.leverPivot.y} ${g.leverPlaneZ}"><joint name="lever" type="hinge" axis="0 0 1" damping=".002"/>${inertial('lever')}
  <body name="roller" pos="${g.leverLength} 0 ${g.workingCamPlaneZ-g.leverPlaneZ}"><joint name="roller" type="hinge" axis="0 0 1" damping=".000001"/>${inertial('roller')}
   <geom name="roller" type="cylinder" size="${g.rollerRadius} ${g.rollerWidth/2}" contype="2" conaffinity="1"/>
  </body>
  <body name="rod" pos="${g.outputArmLength} 0 ${v.rodZ-g.leverPlaneZ}"><joint name="rod" type="hinge" axis="0 0 1" damping=".002"/>${inertial('rod')}<site name="rod-tip" pos="0 ${-v.pinDistance} 0"/></body>
 </body>
 <body name="slider" pos="${v.guideX} ${initial.valve.bottom.y} ${v.rodZ}"><joint name="slider" type="slide" axis="0 1 0" damping=".002"/>${inertial('slider')}<site name="slider-pin"/></body>
 </worldbody><equality><connect site1="rod-tip" site2="slider-pin" solref=".002 1" solimp=".99999 .99999 .0001"/></equality>
 <actuator><position joint="shaft" kp="100000" kv="1000"/><position joint="carrier" kp="100000" kv="1000"/></actuator></mujoco>`;
 const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{
  const angle=initial.follower.leverAngle;data.qpos.set([initial.driveAngle,initial.carrierTranslationZ,angle,-angle,-angle,0]);data.qvel[0]=initial.driveAngularSpeed;
 },beforeStep:({data,time})=>{const s=drive(time);data.ctrl[0]=s.driveAngle+.01*s.driveAngularSpeed;data.ctrl[1]=s.carrierTranslationZ+.01*s.selectorVelocityZ;}});
 return Object.assign(physics,{description:{xml,period,ticksPerPeriod,gravity,multiContact,nativeCCD,mass,density,geometry:g,valve:v,initial,assumptions:'Moving mesh mass tensors at common density normalized to lever mass 1. Only shaft rotation and axial selection are driven. Free lever, roller, pinned rod and vertical slider; assumed damping, friction, gravity and no external valve load. Convex collision cam cores fill inaccessible shaft bores; only cam/roller contact is enabled.'},drive,
  state:()=>({time:physics.data.time,shaft:physics.data.qpos[0],carrier:physics.data.qpos[1],lever:physics.data.qpos[2],roller:physics.data.qpos[3],rod:physics.data.qpos[4],slider:physics.data.qpos[5],velocity:Array.from(physics.data.qvel)})});
}
