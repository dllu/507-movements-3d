import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=v=>v.map(x=>Math.abs(x)<1e-12?0:Number(x.toPrecision(12))).join(' ');

export function makeScrewPressPhysics(mujoco,visual,{timestep=.002,period=8,kp=200,kv=20,torque=3,overrun=.001,contactTime=.006}={}) {
  const u=visual.root.userData,f=u.profile,mass=Object.fromEntries(['screw','ram'].map(name=>[name,rigidFamilyInertia(u.parts,u.families,name)]));
  const density=1/mass.screw.volume,inertia=name=>{const m=mass[name];return `<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(x=>x*density))}"/>`;};
  const cylinder=(name,r,low,high,type)=>`<geom name="${name}" type="cylinder" size="${r} ${(high-low)/2}" pos="0 ${(low+high)/2} 0" quat=".7071067811865476 .7071067811865476 0 0" contype="${type}" conaffinity="${3-type}"/>`;
  const xml=`<mujoco model="105 weighted screw press"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="40" tolerance="1e-10"/>
    <default><geom condim="1" friction="0 0 0" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <worldbody>${cylinder('blank',f.blankRadius,f.workBottom,f.workTop,2)}
      <body name="ram"><joint name="ram" type="slide" axis="0 1 0" damping=".01"/>${inertia('ram')}${cylinder('ram',f.ramRadius,f.ramBottom,f.capBottom,1)}
        <body name="screw"><joint name="screw" type="hinge" axis="0 1 0" damping=".01"/>${inertia('screw')}</body>
      </body>
    </worldbody>
    <equality><joint name="screw_coupling" joint1="ram" joint2="screw" polycoef="0 ${f.lead} 0 0 0" solref=".004 1" solimp=".9999 .99999 .0001"/></equality>
    <actuator><position joint="screw" kp="${kp}" kv="${kv}" forcelimited="true" forcerange="${-torque} ${torque}"/></actuator>
  </mujoco>`;
  const input=time=>{const a=2*Math.PI*time/period,scale=-Math.PI*(f.turns+overrun);return{angle:scale*(1-Math.cos(a)),velocity:scale*2*Math.PI/period*Math.sin(a)};};
  const physics=createMujocoSimulation(mujoco,{xml,beforeStep:({data,time})=>{const p=input(time);data.ctrl[0]=p.angle+kv/kp*p.velocity;}});
  return Object.assign(physics,{bodies:Object.fromEntries(['ram','screw'].map(name=>[name,physics.id('mjOBJ_BODY',name)])),
    description:{xml,input,mass,density,coupling:'ideal screw and captured thrust bearing; ram/blank contact',options:{timestep,period,kp,kv,torque,overrun,contactTime}}});
}
