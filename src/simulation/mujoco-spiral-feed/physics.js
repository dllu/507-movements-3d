import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=v=>v.map(x=>Number(x.toPrecision(12))).join(' ');

// The rail is a thin strip between two sampled offset curves. Each contact
// cell spans `group` consecutive inner/outer quads; its vertices all lie on
// the rendered strip and its polygon area equals theirs. The strip's outer
// (convex) side is exact. MuJoCo's hull of a cell also fills the chord of its
// concave inner side: at 3072 segments and three quads per cell that sliver
// is at most 0.02 engraving pixel deep. Building the cells directly replaces
// the generic triangle-merging decomposition (several seconds on this plate),
// and grouping cuts MuJoCo's per-element model construction cost, which grows
// faster than linearly: the model now builds in about a second, not twenty.
function spiralStripCells(geometry,f,group) {
  geometry.computeBoundingBox();
  const {min:{z:low},max:{z:high}}=geometry.boundingBox,q=p=>p.map(Math.fround),cells=[];
  for(let i=0;i<f.segments;i+=group) {
    const end=Math.min(f.segments,i+group);
    let cell=[...f.inner.slice(i,end+1),...f.outer.slice(i,end+1).reverse()].map(q);
    let area=0;for(let n=0;n<cell.length;n++){const a=cell[n],b=cell[(n+1)%cell.length];area+=a[0]*b[1]-a[1]*b[0];}
    if(area<0)cell=cell.reverse();
    cells.push(cell);
  }
  return {cells,low,high,group,triangleCount:2*f.segments};
}

export function makeSpiralFeedPhysics(mujoco,visual,{timestep=.0005,period=12,friction=.15,contactTime=.004,settlingTime=.5,load=0,contactGroup=1}={}) {
  const u=visual.root.userData,f=u.profile,names=['input','follower','roller'];
  const mass=Object.fromEntries(names.map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.input.volume;
  const inertial=n=>`<inertial pos="${vec(mass[n].centroid)}" mass="${mass[n].volume*density}" fullinertia="${vec(mass[n].inertia.map(x=>x*density))}"/>`;
  const collision=spiralStripCells(u.parts.rail.geometry,f,contactGroup),assets=[];
  const rail=collision.cells.map((cell,i)=>{
    const name='rail'+i,vertices=[collision.low,collision.high].flatMap(z=>cell.flatMap(p=>[...p,z]));
    assets.push(`<mesh name="${name}" vertex="${vec(vertices)}"/>`);
    return `<geom name="${name}" type="mesh" mesh="${name}" contype="1" conaffinity="2"/>`;
  }).join('');
  // The sphere's equator is the roller's actual working circle, inside the
  // rail's depth. Its poles stay within the finite roller's outer envelope;
  // the inaccessible journal bore is filled in this contact proxy. Sphere/
  // mesh contact keeps the normal force through the axis, avoiding the small
  // spurious spin measured with a short capsule and normal-only contact.
  const xml=`<mujoco model="099 spiral drill feed"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-9" cone="elliptic"/>
    <default><geom friction="${friction} .001 .001" condim="${friction===0?1:3}" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <asset>${assets.join('')}</asset><worldbody>
      <body name="input"><joint name="input" type="hinge" axis="0 0 1" damping=".02"/>${inertial('input')}${rail}</body>
      <body name="follower"><joint name="follower" type="slide" axis="0 1 0" damping=".02"/>${inertial('follower')}
        <body name="roller"><joint name="roller" type="hinge" axis="0 0 1" damping=".0000001"/>${inertial('roller')}
          <geom name="roller" type="sphere" size="${f.rollerRadius}" pos="0 0 .09" contype="2" conaffinity="1"/></body>
      </body></worldbody><actuator><position name="motor" joint="input" kp="10000" kv="200"/></actuator></mujoco>`;
  const middle=(f.range[0]+f.range[1])/2,amplitude=(f.range[1]-f.range[0])/2,omega=2*Math.PI/period,phase=-Math.acos(-middle/amplitude);
  const driveAt=time=>{const a=phase+omega*time;return {angle:middle+amplitude*Math.cos(a),velocity:-amplitude*omega*Math.sin(a)};};
  const initial=f.envelope(0).outer.r,derivative=(f.envelope(.00001).outer.r-f.envelope(-.00001).outer.r)/.00002;
  const physics=createMujocoSimulation(mujoco,{xml,initialize:({model,data})=>{
    data.qpos.set([0,-initial,0]);data.ctrl[0]=0;data.qfrc_applied[1]=load;
    for(let i=0;i<Math.round(settlingTime/timestep);i++)mujoco.mj_step(model,data);
    data.time=0;const speed=driveAt(0).velocity;data.qvel.set([speed,-derivative*speed,speed*(initial+f.rollerRadius)/f.rollerRadius]);data.ctrl[0]=.02*speed;
  },beforeStep:({data,time})=>{const d=driveAt(time);data.ctrl[0]=d.angle+.02*d.velocity;}});
  const bodies=Object.fromEntries(names.map(n=>[n,physics.id('mjOBJ_BODY',n)]));
  return Object.assign(physics,{bodies,description:{xml,collision,mass,density,driveAt,options:{timestep,period,friction,contactTime,settlingTime,load,contactGroup}}});
}
