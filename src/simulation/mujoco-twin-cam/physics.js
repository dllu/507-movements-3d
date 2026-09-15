import {createMujocoSimulation} from '../mujoco/simulation.js';
import {twinCamSource as g,twinCamContours,twinCamLevers} from './source.js';
export function makeTwinCamPhysics(mujoco,{timestep=.0005,period=g.period,gravity=9.81}={}){
 const contours=twinCamContours(),assets=[],cams=[];
 for(let i=0;i<2;i++){
  const vertices=contours[i].flatMap(([x,y])=>[-.12,.12].flatMap(z=>[x,y,z]));
  assets.push(`<mesh name="cam${i}" vertex="${vertices.join(' ')}"/>`);
  cams.push(`<geom name="cam${i}" type="mesh" mesh="cam${i}" pos="0 0 ${g.planes[i]}" contype="1" conaffinity="2"/>`);
 }
 const levers=twinCamLevers.map((l,i)=>{
  const transverse=.025*l.radius**2+.1*.28**2/12,polar=.05*l.radius**2;
  return `<body name="lever${i}" pos="0 0 ${l.z}">
   <joint name="lever${i}" type="hinge" axis="0 0 1" damping=".002"/>
   <inertial pos="${l.length/2} 0 0" mass="1" diaginertia=".002 ${l.length**2/12+.002} ${l.length**2/12+.002}"/>
   <body name="roller${i}" pos="${l.length} 0 0"><joint name="roller${i}" type="hinge" axis="0 0 1" damping=".000001"/>
    <inertial pos="0 0 0" mass=".1" diaginertia="${transverse} ${transverse} ${polar}"/>
    <geom name="roller${i}" type="cylinder" size="${l.radius} .14" contype="2" conaffinity="1"/>
   </body></body>`;
 }).join('');
 const shaft=[(g.shaft[0]-g.pivot[0])*g.scale,(g.pivot[1]-g.shaft[1])*g.scale];
 const xml=`<mujoco model="149 traced twin cam gravity prototype"><compiler angle="radian" inertiafromgeom="false"/>
 <option timestep="${timestep}" gravity="0 -${gravity} 0" integrator="implicitfast" iterations="80" tolerance="1e-10" cone="elliptic"/>
 <default><geom friction=".15 .001 .0001" condim="3" solref=".004 1" solimp=".999 .9999 .0001"/></default>
 <asset>${assets.join('')}</asset><worldbody><body name="cams" pos="${shaft.join(' ')} 0"><joint name="shaft" type="hinge" axis="0 0 1"/>
 <inertial pos="0 0 0" mass="1" diaginertia="1 1 1"/>${cams.join('')}</body>${levers}</worldbody>
 <actuator><position joint="shaft" kp="100000" kv="1000"/></actuator></mujoco>`;
 const omega=2*Math.PI/period;
 const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{
  data.qpos.set([0,twinCamLevers[0].angle,0,twinCamLevers[1].angle,0]);data.qvel[0]=omega;
 },beforeStep:({data,time})=>{data.ctrl[0]=omega*time+.01*omega;}});
 return Object.assign(physics,{description:{xml,contours,levers:twinCamLevers,options:{timestep,period,gravity},assumptions:'Uniform one-unit-mass rods and 0.1-unit-mass rollers. No output rod load. Only the cam shaft is driven; lever lift and roller spin are passive.'},
  state:()=>({time:physics.data.time,shaft:physics.data.qpos[0],upper:physics.data.qpos[1],upperRoll:physics.data.qpos[2],lower:physics.data.qpos[3],lowerRoll:physics.data.qpos[4]})});
}
