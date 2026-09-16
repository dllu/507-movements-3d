import { createMujocoSimulation } from '../mujoco/simulation.js';
import { dualBandPawlDimensions as d, dualBandSeatPhase, ratchet390Outline, turn390, toe390Contact } from '../dual-band-pawl-contact.js';
const vec=a=>a.map(x=>Number(x.toPrecision(12))).join(' ');
export function makeDualBandContactStudy(mujoco,{timestep=.00025,contact=true,period=8,
  outputDamping=.18,pawlSpring=.03,pawlDamping=.00008,contactMargin=.0006,carrierGain=2000000,inputPhase=-Math.PI/2}={}){
  const A=(Math.PI+d.overtravel)/2,omega=2*Math.PI/period,assets=[],geomNames={};
  const outline=ratchet390Outline(d.mountPhase+dualBandSeatPhase);
  const wheelGeoms=[.44,.88].map((z,layer)=>outline.map((a,i)=>{
    const b=outline[(i+1)%outline.length],name=`wheel-${layer}-${i}`;
    const vertices=[-.05,.05].flatMap(h=>[[0,0,z+h],[a[0],a[1],z+h],[b[0],b[1],z+h]]);
    assets.push(`<mesh name="${name}" vertex="${vec(vertices.flat())}"/>`);geomNames[name]='ratchet';
    return`<geom name="${name}" type="mesh" mesh="${name}" contype="${contact?1:0}" conaffinity="${contact?2:0}"/>`;
  }).join('')).join('');
  const carriers=[['open',d.mountPhase,.29],['crossed',d.mountPhase+Math.PI,.73]].map(([name,phase,z])=>{
    const pivot=turn390([d.pivotRadius,0],phase),x=.075,y=-d.bow*Math.sin(Math.PI*x/d.length),length=Math.hypot(x,y),r=.014;
    const stopLocal=[x-y/length*(r+d.armHalfWidth+.0005),y+x/length*(r+d.armHalfWidth+.0005)],stop=turn390(stopLocal,phase+d.seatAngle);
    let arm='';for(let i=0;i<20;i++){
      const p=[i/20,(i+1)/20].map(t=>[d.length*t,-d.bow*Math.sin(Math.PI*t),0]);
      arm+=`<geom name="${name}-arm-${i}" type="capsule" fromto="${vec(p.flat())}" size="${d.armHalfWidth+.00017}" contype="2" conaffinity="5"/>`;geomNames[`${name}-arm-${i}`]=`${name}-arm`;
    }
    geomNames[`${name}-toe`]=`${name}-toe`;geomNames[`${name}-stop`]=`${name}-stop`;
    return`<body name="${name}-carrier"><joint name="${name}-carrier" axis="0 0 1" damping=".005"/><inertial pos="0 0 ${z}" mass=".08" diaginertia=".008 .008 .012"/>
      <geom name="${name}-stop" type="cylinder" pos="${vec([pivot[0]+stop[0],pivot[1]+stop[1],z+.15])}" size=".014 .0325" contype="4" conaffinity="2"/>
      <body name="${name}-pawl" pos="${vec([...pivot,z+.165])}" euler="0 0 ${phase+d.seatAngle}">
        <joint name="${name}-pawl" axis="0 0 1" stiffness="${pawlSpring}" springref=".4" damping="${pawlDamping}"/>
        <inertial pos=".12 -.035 0" mass=".003" diaginertia=".0000015 .000014 .000015"/>
        ${arm}<geom name="${name}-toe" type="cylinder" pos="${d.length} 0 0" size="${d.tipRadius} ${d.depth/2}" contype="2" conaffinity="5"/>
      </body></body>`;
  }).join('');
  const xml=`<mujoco model="390 passive flywheel and pawls"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="80" tolerance="1e-10" cone="elliptic"><flag filterparent="disable" multiccd="disable"/></option>
    <default><geom margin="${contactMargin}" condim="1" friction="0 0 0" solref=".001 1" solimp=".99 .999 .001"/></default>
    <asset>${assets.join('')}</asset><worldbody>${carriers}<body name="flywheel"><joint name="flywheel" axis="0 0 1" damping="${outputDamping}"/><inertial pos="0 0 0" mass="1" diaginertia=".8 .8 1.6"/>${wheelGeoms}</body></worldbody>
    <actuator><position joint="open-carrier" kp="${carrierGain}" kv="${carrierGain*.01}"/><position joint="crossed-carrier" kp="${carrierGain}" kv="${carrierGain*.01}"/></actuator></mujoco>`;
  const input=t=>({angle:A*Math.sin(omega*t+inputPhase),velocity:A*omega*Math.cos(omega*t+inputPhase)});
  const p=createMujocoSimulation(mujoco,{xml,initialize:({model,data,id})=>{
    const start=input(0);
    data.qpos[model.jnt_qposadr[id('mjOBJ_JOINT','open-carrier')]]=start.angle;
    data.qpos[model.jnt_qposadr[id('mjOBJ_JOINT','crossed-carrier')]]=-start.angle;
    // Start beyond the collision margins instead of letting stabilization of
    // a preloaded stop/working-flank pair impart a spurious flywheel impulse.
    const settledPawl=-.0152;
    let low=0,high=.02;for(let i=0;i<45;i++){const x=(low+high)/2;if(toe390Contact(d.seatAngle+settledPawl,dualBandSeatPhase+x).gap<2*contactMargin+.00002)low=x;else high=x;}
    data.qpos[model.jnt_qposadr[id('mjOBJ_JOINT','flywheel')]]=inputPhase===-Math.PI/2?A+Math.PI+(low+high)/2:0;
    data.qpos[model.jnt_qposadr[id('mjOBJ_JOINT','open-pawl')]]=inputPhase===-Math.PI/2?settledPawl:0;
    data.qpos[model.jnt_qposadr[id('mjOBJ_JOINT','crossed-pawl')]]=inputPhase===-Math.PI/2?settledPawl:-.20;
    data.qvel[model.jnt_dofadr[id('mjOBJ_JOINT','open-carrier')]]=start.velocity;
    data.qvel[model.jnt_dofadr[id('mjOBJ_JOINT','crossed-carrier')]]=-start.velocity;
  },beforeStep:({data,time})=>{const s=input(time-timestep);data.ctrl[0]=s.angle+.01*s.velocity;data.ctrl[1]=-s.angle-.01*s.velocity;}});
  const names=['open-carrier','open-pawl','crossed-carrier','crossed-pawl','flywheel'];
  const joints=names.map(name=>{const i=p.id('mjOBJ_JOINT',name);return{name,q:p.model.jnt_qposadr[i],v:p.model.jnt_dofadr[i]};});
  return Object.assign(p,{description:{xml,options:{timestep,contact,period,outputDamping,pawlSpring,pawlDamping,contactMargin,carrierGain,inputPhase},input,assumptions:'Only the two ideal band-driven carrier hinges are actuated. Flywheel and pawls are passive. Inferred normalized masses/inertias, torsion springs, gravity and viscous resisting load; finite outer tooth cells, toe cylinders and curved-arm capsule envelope.'},joints,geomNames,state(){return{time:p.data.time,q:joints.map(j=>p.data.qpos[j.q]),v:joints.map(j=>p.data.qvel[j.v])};}});
}
