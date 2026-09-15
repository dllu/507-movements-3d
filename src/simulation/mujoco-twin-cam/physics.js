import {makeTwinCamGeometry} from './geometry.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
import {twinCamSource as g,twinCamContours,twinCamLevers} from './source.js';
export function makeTwinCamPhysics(mujoco,{timestep=.0005,period=g.period,gravity=9.81,rodDamping=.002,guided=true}={}){
 const visual=makeTwinCamGeometry({guided}),mass=visual.root.userData.mass;visual.dispose();
 const density=1/mass.lever0.volume;
 const inertial=name=>{const m=mass[name];return `<inertial pos="${m.centroid.join(' ')}" mass="${m.volume*density}" fullinertia="${m.inertia.map(v=>v*density).join(' ')}"/>`;};
 const contours=twinCamContours(),assets=[],cams=[];
 for(let i=0;i<2;i++){
  const vertices=contours[i].flatMap(([x,y])=>[-.12,.12].flatMap(z=>[x,y,z]));
  assets.push(`<mesh name="cam${i}" vertex="${vertices.join(' ')}"/>`);
  cams.push(`<geom name="cam${i}" type="mesh" mesh="cam${i}" pos="0 0 ${g.planes[i]}" contype="1" conaffinity="2"/>`);
 }
 const levers=twinCamLevers.map((l,i)=>{
  return `<body name="lever${i}" pos="0 0 ${l.z}">
   <joint name="lever${i}" type="hinge" axis="0 0 1" damping=".002"/>
   ${inertial('lever'+i)}
   <body name="roller${i}" pos="${l.length} 0 0"><joint name="roller${i}" type="hinge" axis="0 0 1" damping=".000001"/>
    ${inertial('roller'+i)}
    <geom name="roller${i}" type="cylinder" size="${l.radius} .14" contype="2" conaffinity="1"/>
   </body><body name="rod${i}" pos="${l.attachment} 0 ${l.rodZ}"><joint name="rod${i}" type="hinge" axis="0 0 1" damping="${rodDamping}"/>${inertial('rod'+i)}<site name="rod-tip${i}" pos="0 ${-l.rodPinDistance} 0"/></body></body>`;
 }).join('');
 const sliders=guided?twinCamLevers.map((l,i)=>`<body name="slider${i}" pos="${l.guideX} ${l.guideY} ${l.z+l.rodZ}"><joint name="slide${i}" type="slide" axis="0 1 0" damping=".002"/>${inertial('slider'+i)}<site name="slider-tip${i}"/></body>`).join(''):'';
 const connections=guided?`<equality>${[0,1].map(i=>`<connect site1="rod-tip${i}" site2="slider-tip${i}" solref=".002 1" solimp=".99999 .99999 .0001"/>`).join('')}</equality>`:'';
 const shaft=[(g.shaft[0]-g.pivot[0])*g.scale,(g.pivot[1]-g.shaft[1])*g.scale];
 const xml=`<mujoco model="149 traced twin cam gravity prototype"><compiler angle="radian" inertiafromgeom="false"/>
 <option timestep="${timestep}" gravity="0 -${gravity} 0" integrator="implicitfast" iterations="80" tolerance="1e-10" cone="elliptic"/>
 <default><geom friction=".15 .001 .0001" condim="3" solref=".004 1" solimp=".999 .9999 .0001"/></default>
 <asset>${assets.join('')}</asset><worldbody><body name="cams" pos="${shaft.join(' ')} 0"><joint name="shaft" type="hinge" axis="0 0 1"/>
 ${inertial('cams')}${cams.join('')}</body>${levers}${sliders}</worldbody>${connections}
 <actuator><position joint="shaft" kp="100000" kv="1000"/></actuator></mujoco>`;
 const omega=2*Math.PI/period;
 const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{
  data.qpos.set([0,twinCamLevers[0].angle,0,-twinCamLevers[0].angle,twinCamLevers[1].angle,0,-twinCamLevers[1].angle]);data.qvel[0]=omega;
 },beforeStep:({data,time})=>{data.ctrl[0]=omega*time+.01*omega;}});
 return Object.assign(physics,{description:{xml,contours,levers:twinCamLevers,mass,density,options:{timestep,period,gravity,rodDamping,guided},assumptions:'Visible moving geometry integrated at common density, normalized to upper lever mass 1. Ordinary pinned rods connect to inferred vertical output sliders when guided=true; guides are not depicted in the source. Assumed hinge damping and no external output load. Only the cam shaft is driven.'},
  state:()=>({time:physics.data.time,velocity:Array.from(physics.data.qvel),shaft:physics.data.qpos[0],upper:physics.data.qpos[1],upperRoll:physics.data.qpos[2],upperRod:physics.data.qpos[3],lower:physics.data.qpos[4],lowerRoll:physics.data.qpos[5],lowerRod:physics.data.qpos[6],upperSlide:guided?physics.data.qpos[7]:0,lowerSlide:guided?physics.data.qpos[8]:0})});
}
