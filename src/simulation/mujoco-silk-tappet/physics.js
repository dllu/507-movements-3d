import {createMujocoSimulation} from '../mujoco/simulation.js';

// Offline contact reconstruction: only the input carrier is driven.
// Straight tappet-wheel teeth, screw friction and inertia are inferred.
export function makeSilkTappetPhysics(mujoco, {timestep=.00005, height=.6305,
  phase=.171058, friction=.002, damping=.3, enabled=true, speed=2*Math.PI/4}={}) {
  const radialScale=1.3,axialScale=1.55,pinRadius=.0325;
  const station=2.53, teeth=18, pitch=2*Math.PI/teeth, start=-.3;
  const toothGeoms=Array.from({length:teeth},(_,i)=>{
    const a=i*pitch+phase;
    return `<geom name="tooth${i}" type="box" pos="0 ${.435*radialScale*Math.cos(a)} ${.435*radialScale*Math.sin(a)}" euler="${a} 0 0" size="${.055*axialScale} ${.045*radialScale} ${.022*radialScale}"/>`;
  }).join('');
  const xml=`<mujoco><compiler angle="radian"/><option timestep="${timestep}" gravity="0 0 0" integrator="implicitfast" iterations="100" tolerance="1e-10"/>
  <default><geom contype="1" conaffinity="1" condim="1" margin=".0005" solref=".0002 1" solimp=".9999 .9999 .001"/></default>
  <worldbody><geom name="tappet" type="sphere" pos="${station} 0 ${height}" size="${pinRadius}" contype="${enabled?1:0}" conaffinity="${enabled?1:0}"/>
  <body><joint name="carrier" axis="0 0 1"/><inertial pos="0 0 0" mass="1" diaginertia="1 1 1"/>
  <body pos="${station} 0 0"><joint name="wheel" axis="1 0 0" damping="${damping}" frictionloss="${friction}"/>
  <inertial pos="0 0 0" mass=".02" diaginertia="${.0002*radialScale**2} ${.0001*radialScale**2} ${.0001*radialScale**2}"/>
  <geom name="hub" type="cylinder" size="${.395*radialScale} ${.055*axialScale}" euler="0 ${Math.PI/2} 0"/>${toothGeoms}</body></body></worldbody>
  <actuator><position joint="carrier" kp="200000" kv="2000"/></actuator></mujoco>`;
  const p=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qpos[0]=start;data.qvel[0]=speed;},
    beforeStep:({data,time})=>{data.ctrl[0]=start+speed*(time-timestep)+.01*speed;}});
  return Object.assign(p,{parameters:{radialScale,axialScale,pinRadius,timestep,height,phase,friction,damping,enabled,speed,station,teeth,pitch,start},
    state:()=>({time:p.data.time,carrier:p.data.qpos[0],wheel:p.data.qpos[1],wheelSpeed:p.data.qvel[1],contacts:p.data.ncon})});
}
