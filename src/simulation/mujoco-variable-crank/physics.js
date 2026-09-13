import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

const vec=values=>values.map(v=>Number(v.toPrecision(12))).join(' ');
export function makeVariableCrankPhysics(mujoco,visual,{timestep=.001,period=8,friction=.03,contactTime=.004,settlingTime=.5,motorStiffness=10000,motorDamping=200}={}) {
  const u=visual.root.userData,g=u.geometry,assets=[];
  const mass=Object.fromEntries(['input','bolt'].map(name=>[name,rigidFamilyInertia(u.parts,u.families,name)])),density=1/mass.input.volume;
  const inertial=name=>`<inertial pos="${vec(mass[name].centroid)}" mass="${mass[name].volume*density}" fullinertia="${vec(mass[name].inertia.map(x=>x*density))}"/>`;
  const walls=u.wallPieces.map((points,i)=>{
    const name='wall'+i,vertices=[-.18,0].flatMap(z=>points.flatMap(p=>[...p,z]));
    assets.push(`<mesh name="${name}" vertex="${vec(vertices)}"/>`);
    return `<geom name="${name}" type="mesh" mesh="${name}" contype="1" conaffinity="2"/>`;
  }).join('');
  // The capsule is contained within the finite bolt. Its cylindrical middle
  // has the same working radius and overlaps the groove's axial layer. Ideal
  // planar joints exclude tilt, so rounded remote ends do not change the
  // working envelope; they avoid unstable flat-end cylinder/mesh contacts.
  const xml=`<mujoco model="094 variable crank"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-9" cone="elliptic"/>
    <default><geom friction="${friction} .001 .001" condim="3" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <asset>${assets.join('')}</asset><worldbody>
      <body name="input"><joint name="input" type="hinge" axis="0 0 1" damping=".02"/>${inertial('input')}${walls}</body>
      <body name="bolt"><joint name="bolt" type="slide" axis="${vec([...g.direction,0])}" damping=".01"/>${inertial('bolt')}
        <geom name="bolt" type="capsule" size="${g.neckRadius}" fromto="0 0 -.14 0 0 .04" contype="2" conaffinity="1"/></body>
    </worldbody><actuator><position name="motor" joint="input" kp="${motorStiffness}" kv="${motorDamping}"/></actuator></mujoco>`;
  const range=[2.5,12.7],middle=(range[0]+range[1])/2,amplitude=(range[1]-range[0])/2,omega=2*Math.PI/period;
  const phase=Math.acos((middle-g.pinAngle)/amplitude);
  const driveAt=time=>{const phaseNow=phase+omega*time;return {angle:g.pinAngle-middle+amplitude*Math.cos(phaseNow),velocity:-amplitude*omega*Math.sin(phaseNow)};};
  const physics=createMujocoSimulation(mujoco,{xml,
    initialize:({data,model})=>{
      data.qpos.set([0,g.initialRadius]);data.ctrl[0]=0;
      for(let i=0;i<Math.round(settlingTime/timestep);i++)mujoco.mj_step(model,data);
      data.time=0;data.qvel[0]=driveAt(0).velocity;data.qvel[1]=-u.derivative(g.pinAngle-data.qpos[0])*data.qvel[0];
      data.ctrl[0]=motorDamping/motorStiffness*data.qvel[0];
    },beforeStep:({data,time})=>{const d=driveAt(time);data.ctrl[0]=d.angle+motorDamping/motorStiffness*d.velocity;},
  });
  const joints=Object.fromEntries(['input','bolt'].map(name=>{const id=physics.id('mjOBJ_JOINT',name);return [name,{q:physics.model.jnt_qposadr[id],v:physics.model.jnt_dofadr[id]}];}));
  const bodies=Object.fromEntries(Object.keys(joints).map(name=>[name,physics.id('mjOBJ_BODY',name)]));
  return Object.assign(physics,{joints,bodies,description:{xml,mass,density,range,driveAt,options:{timestep,period,friction,contactTime,settlingTime,motorStiffness,motorDamping}}});
}
