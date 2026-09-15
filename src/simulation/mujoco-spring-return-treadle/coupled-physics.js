import {createMujocoSimulation} from '../mujoco/simulation.js';
import {returnLeafAssembly} from './leaf-assembly.js';
import {ReturnBandRoute} from './band-route.js';

// Coupling diagnostic: a unilateral compliant ideal band transmits tension.
// The pulley is massless; full-wrap geometry supplies exact length gradients.
// Source-pose prestress balances gravity; real material and hardware/contact remain to qualify.
export function makeSpringTreadlePhysics(mujoco,{segments=32,tailSegments=6,timestep=.000125,EI=2000,viscosity=200,bandStiffness=20000,bandDamping=20,footLoad=6,band=true,period=4,gravity=98.1,preload=true}={}){
 const leaf=returnLeafAssembly({segments,tailSegments,EI,viscosity,mass:.2}),pivot=[-2.862,-2.898],eye=[3.6,.576],foot=[5.274,.666];
 let nominal=new ReturnBandRoute([.774,2.664],[pivot[0]+eye[0],pivot[1]+eye[1]]).length;
 const xml=`<mujoco><compiler angle="radian"/><option timestep="${timestep}" gravity="0 -${gravity} 0" integrator="implicitfast"/><default><geom contype="0" conaffinity="0"/><site size=".01"/></default><worldbody>${leaf.bodies}<body name="treadle" pos="${pivot.join(' ')} 0"><joint name="treadle" axis="0 0 1" damping=".2"/><geom type="capsule" fromto="0 0 0 ${foot.join(' ')} 0" size=".05" mass=".5"/><site name="treadle-eye" pos="${eye.join(' ')} 0"/><site name="foot" pos="${foot.join(' ')} 0"/></body></worldbody></mujoco>`;
 let upperId,lowerId,footId,treadleDof,initialTension=0,lastTension=0,lastLoad=0;
 const site=(data,id)=>Array.from(data.site_xpos.slice(3*id,3*id+3));
 const route=data=>new ReturnBandRoute(site(data,upperId),site(data,lowerId));
 const gradient=(data,r)=>{
  const values=new Float64Array(data.qpos.length),upper=site(data,upperId),lower=site(data,lowerId);
  for(let i=0;i<leaf.source.eyeIndex-1;i++)values[i]=(upper[0]-data.xanchor[3*i])*r.upperGradient.y-(upper[1]-data.xanchor[3*i+1])*r.upperGradient.x;
  values[treadleDof]=(lower[0]-pivot[0])*r.lowerGradient.y-(lower[1]-pivot[1])*r.lowerGradient.x;return values;
 };
 const p=createMujocoSimulation(mujoco,{xml,initialize:({model,data,id})=>{upperId=id('mjOBJ_SITE','tie');lowerId=id('mjOBJ_SITE','treadle-eye');footId=id('mjOBJ_SITE','foot');treadleDof=model.jnt_dofadr[id('mjOBJ_JOINT','treadle')];lastTension=lastLoad=0;
  mujoco.mj_forward(model,data);const r=route(data),g=gradient(data,r);
  initialTension=preload&&band?-data.qfrc_bias[treadleDof]/g[treadleDof]:0;
  nominal=r.length-initialTension/bandStiffness;
  for(let j=0;j<treadleDof;j++)model.qpos_spring[j]=preload?(data.qfrc_bias[j]+initialTension*g[j])/model.jnt_stiffness[j]:0;
 },beforeStep:({model,data,time})=>{
  mujoco.mj_kinematics(model,data);data.qfrc_applied.fill(0);const r=route(data),g=gradient(data,r),extension=r.length-nominal,rate=g.reduce((sum,x,i)=>sum+x*data.qvel[i],0);
  lastTension=band&&extension>0?Math.max(0,bandStiffness*extension+bandDamping*rate):0;
  for(let i=0;i<g.length;i++)data.qfrc_applied[i]=-lastTension*g[i];
  // Smooth downward foot pressure for the first half of each four-second
  // cycle; the second half has no applied foot force.
  const phase=(time%period)/period;lastLoad=phase<.5?footLoad*Math.sin(2*Math.PI*phase)**2:0;
  data.qfrc_applied[treadleDof]-=lastLoad*(data.site_xpos[3*footId]-pivot[0]);
 }});
 const ends=leaf.lengths.map((_,i)=>p.id('mjOBJ_SITE',`end-${i}`));
 return Object.assign(p,{nominal,description:{segments,tailSegments,timestep,EI,viscosity,bandStiffness,bandDamping,footLoad,band,period,gravity,preload,initialTension,assumptions:'Diagnostic only: inextensible elastic leaf, force-driven treadle, compliant tension-only full-wrap band, massless frictionless pulley, gravity. Stress-free joint angles and band rest length are inferred to balance gravity in the source pose. Real material parameters, drum inertia and visible hardware/contact remain unqualified.'},state:()=>{mujoco.mj_kinematics(p.model,p.data);const r=route(p.data);return{time:p.data.time,qpos:Array.from(p.data.qpos),qvel:Array.from(p.data.qvel),upper:site(p.data,upperId),lower:site(p.data,lowerId),foot:site(p.data,footId),treadle:p.data.qpos[treadleDof],tension:lastTension,footLoad:lastLoad,bandLength:r.length,bandExtension:r.length-nominal,rotorPhase:r.rotorPhase,leafPoints:[leaf.points[0].toArray(),...ends.map(id=>site(p.data,id))]};}});
}
