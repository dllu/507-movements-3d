import {createMujocoSimulation} from '../mujoco/simulation.js';
import {fanGovernorTrack,fanGovernorTrackCells} from './source.js';

// Contact prototype, not yet the visible 147 model. Two crowned rollers run
// on convex cells of the rotating tracks. Crosshead lift and lag are free.
export function makeFanGovernorPhysics(mujoco,{timestep=.001,segments=160,drag=1.5,speed=3,gravity=9.81,massProperties}={}){
 const {radius,rollerRadius,base,curvature}=fanGovernorTrack;
 // Increasing slope supplies increasing gravitational restoring torque.
 // This profile is inferred, not dimensioned by the source engraving.
 const assets=[],geoms=[];
 const inertial=(name,fallback)=>{
  if(!massProperties)return fallback;
  const m=massProperties[name],density=1/massProperties.crosshead.volume;
  return `<inertial pos="${m.centroid.join(' ')}" mass="${m.volume*density}" fullinertia="${m.inertia.map(v=>v*density).join(' ')}"/>`;
 };
 for(const {name,vertices} of fanGovernorTrackCells(segments)){
  assets.push(`<mesh name="${name}" vertex="${vertices.flat().join(' ')}"/>`);
  geoms.push(`<geom name="${name}" type="mesh" mesh="${name}" contype="1" conaffinity="2"/>`);
 }
 const rollers=[-1,1].map((side,i)=>`<body name="roller${i}" pos="${side*radius} 0 0">
  <joint name="roll${i}" type="hinge" axis="1 0 0" damping=".000001"/>
  ${inertial('roller'+i,'<inertial pos="0 0 0" mass=".015" diaginertia=".000265 .000265 .000265"/>')}
  <geom name="roller${i}" type="sphere" size="${rollerRadius}" contype="2" conaffinity="1"/>
 </body>`).join('');
 const xml=`<mujoco model="147 passive fan governor prototype"><compiler angle="radian" inertiafromgeom="false"/>
 <option timestep="${timestep}" gravity="0 -${gravity} 0" integrator="implicitfast" solver="Newton" iterations="80" tolerance="1e-10" cone="elliptic"/>
 <default><geom friction=".15 .0001 .0001" condim="3" solref=".004 1" solimp=".999 .9999 .0001"/></default>
 <asset>${assets.join('')}</asset><worldbody>
 <body name="shaft"><joint name="shaft" axis="0 1 0"/>
 <inertial pos="0 0 0" mass="1" diaginertia="1 1 1"/>${geoms.join('')}</body>
 <body name="crosshead"><joint name="lift" type="slide" axis="0 1 0" damping=".03"/>
 <joint name="yaw" type="hinge" axis="0 1 0" damping=".01"/>
 ${inertial('crosshead','<inertial pos="0 1.2 0" mass="1" diaginertia="2 1 2"/>')}${rollers}</body>
 </worldbody><actuator><position name="motor" joint="shaft" kp="100000" kv="1000"/></actuator></mujoco>`;
 const driveAt=time=>{
  const ramp=2,u=Math.min(time/ramp,1);
  return {angle:.55+(time<ramp?speed*ramp*(u**3-.5*u**4):speed*(time-ramp/2)),
    velocity:speed*(3*u*u-2*u*u*u)};
 };
 const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{
  data.qpos.set([.55,.5,0,0,0]);data.ctrl[0]=.55;
 },beforeStep:({data,time})=>{
  const d=driveAt(time),w=data.qvel[2];data.ctrl[0]=d.angle+.01*d.velocity;
  data.qfrc_applied[2]=-drag*w*Math.abs(w);
 }});
 return Object.assign(physics,{description:{xml,options:{timestep,segments,drag,speed,gravity},massProperties,radius,rollerRadius,base,curvature,driveAt},
  state:()=>({time:physics.data.time,shaft:physics.data.qpos[0],lift:physics.data.qpos[1],yaw:physics.data.qpos[2],
    lag:physics.data.qpos[0]-physics.data.qpos[2],speed:physics.data.qvel[2],roll0:physics.data.qpos[3],roll1:physics.data.qpos[4],contacts:physics.data.ncon})});
}
