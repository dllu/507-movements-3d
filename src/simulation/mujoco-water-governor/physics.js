import {createMujocoSimulation} from '../mujoco/simulation.js';
import {governorEquilibrium} from '../mujoco-ball-governor/equilibrium.js';

export const waterGovernorGeometry=()=>({topY:4.3,pivotRadius:.288,ballArm:3.414,elbowArm:2.035,lowerLink:1.787,sleeveRadius:.270,ballRadius:.612,initialSpread:.375,gravity:98.1,ballMass:1,upperMass:.02,lowerMass:.02,sleeveMass:.1,upperRadius:.035,lowerRadius:.03});

// Diagnostic full linkage: only the spindle is actuated. The governor sleeve
// carries a real finite pin; both loose gears and the output shaft are passive.
export function makeWaterGovernorPhysics(mujoco,{timestep=.0005,period=8,speedAmplitude=.32,studPhase=0,contact=true}={}) {
 const g=waterGovernorGeometry(),initial=governorEquilibrium(g.initialSpread,g),apex=g.topY+(55-414)*.018;
 const selectorOffset=apex+.08-initial.sleeveY,frequency=2*Math.PI/period;
 const drive=t=>({speed:initial.speed+speedAmplitude*Math.sin(frequency*t),angle:initial.speed*t+speedAmplitude*(1-Math.cos(frequency*t))/frequency});
 let arms='',connections='';
 for(const sign of [-1,1]){
  const name=sign<0?'left':'right';
  arms+=`<body name="${name}" pos="${sign*g.pivotRadius} 0 0" euler="0 0 ${sign*g.initialSpread}"><joint name="${name}-spread" axis="0 0 ${sign}" damping=".08"/><geom type="capsule" fromto="0 0 0 0 -${g.ballArm} 0" size=".035" mass=".02"/><geom type="sphere" pos="0 -${g.ballArm} 0" size="${g.ballRadius}" mass="1"/><body name="${name}-link" pos="0 -${g.elbowArm} 0" euler="0 0 ${sign*(initial.lowerAngle-g.initialSpread)}"><joint name="${name}-link" axis="0 0 ${sign}" damping=".02"/><geom type="capsule" fromto="0 0 0 0 -${g.lowerLink} 0" size=".03" mass=".02"/><site name="${name}-end" pos="0 -${g.lowerLink} 0"/></body></body>`;
  connections+=`<connect site1="${name}-end" site2="${name}-sleeve" solref=".002 1" solimp=".9999 .9999 .001"/>`;
 }
 const contactBits=contact?'contype="1" conaffinity="2"':'contype="0" conaffinity="0"';
 const gears=[['upper',.30,.09],['lower',-.24,.10]].map(([name,y,half])=>`<body name="${name}-gear" pos="0 ${apex} 0" euler="0 ${studPhase} 0"><joint name="${name}-gear" axis="0 1 0"/><inertial pos="0 0 0" mass=".05" diaginertia=".005 .005 .005"/><geom name="${name}-stud" type="box" pos=".43 ${y} 0" size=".045 ${half} .045" ${contactBits}/></body>`).join('');
 const xml=`<mujoco><compiler angle="radian"/><option timestep="${timestep}" gravity="0 -${g.gravity} 0" integrator="implicitfast" solver="Newton" iterations="100" tolerance="1e-10"/><default><geom contype="0" conaffinity="0" friction=".15 .001 .0001" solref=".002 1" solimp=".9999 .9999 .001"/><site size=".01"/></default><worldbody><body name="rotor" pos="0 ${g.topY} 0"><joint name="spindle" axis="0 1 0"/><inertial pos="0 0 0" mass=".2" diaginertia=".05 .05 .05"/>${arms}<body name="sleeve" pos="0 ${initial.sleeveY-g.topY} 0"><joint name="sleeve" type="slide" axis="0 1 0" damping=".1"/><inertial pos="0 0 0" mass=".1" diaginertia=".001 .001 .001"/><geom name="selector-pin" type="box" pos=".34 ${selectorOffset} 0" size=".18 .045 .045" contype="2" conaffinity="1"/><site name="left-sleeve" pos="-${g.sleeveRadius} 0 0"/><site name="right-sleeve" pos="${g.sleeveRadius} 0 0"/></body></body>${gears}<body name="output" pos="0 ${apex} 0"><joint name="output" axis="1 0 0" damping=".03" frictionloss=".02"/><inertial pos="0 0 0" mass=".05" diaginertia=".002 .002 .002"/></body></worldbody><equality>${connections}<joint joint1="upper-gear" joint2="output" polycoef="0 1 0 0 0" solref=".002 1"/><joint joint1="lower-gear" joint2="output" polycoef="0 -1 0 0 0" solref=".002 1"/></equality><actuator><position joint="spindle" kp="10000" kv="100"/></actuator></mujoco>`;
 let dofs,studIds;
 const p=createMujocoSimulation(mujoco,{xml,initialize:({model,data,id})=>{
  dofs=Object.fromEntries(['spindle','left-spread','right-spread','sleeve','upper-gear','lower-gear','output'].map(name=>[name,model.jnt_dofadr[id('mjOBJ_JOINT',name)]]));
  studIds=['upper-stud','lower-stud'].map(name=>id('mjOBJ_GEOM',name));data.qvel[dofs.spindle]=initial.speed;
 },beforeStep:({data,time})=>{const d=drive(time-timestep);data.ctrl[0]=d.angle+.01*d.speed;}});
 const sites=['left-end','left-sleeve','right-end','right-sleeve'].map(name=>p.id('mjOBJ_SITE',name));
 return Object.assign(p,{geometry:g,description:{movement:162,timestep,period,speedAmplitude,studPhase,contact,nominalSpeed:initial.speed,selectorOffset,apex,assumptions:'Source-proportioned ideal governor hinges, inferred effective masses and selector/stud depths. Passive finite pin/stud contact; ideal equal-ratio bevel constraints and inferred output friction. No water-wheel, gate inertia or hydraulic feedback.'},state:()=>{
  mujoco.mj_kinematics(p.model,p.data);const q=name=>p.data.qpos[dofs[name]],speed=name=>p.data.qvel[dofs[name]],contacts=[];
  for(let i=0;i<p.data.ncon;i++){const c=p.data.contact.get(i);if(studIds.includes(c.geom1)||studIds.includes(c.geom2))contacts.push({geom1:c.geom1,geom2:c.geom2,distance:c.dist});}
  const pos=id=>Array.from(p.data.site_xpos.slice(3*id,3*id+3));
  return{time:p.data.time,spindle:q('spindle'),speed:speed('spindle'),leftSpread:g.initialSpread+q('left-spread'),rightSpread:g.initialSpread+q('right-spread'),sleeveY:initial.sleeveY+q('sleeve'),selectorY:initial.sleeveY+q('sleeve')+selectorOffset,upper:q('upper-gear'),lower:q('lower-gear'),output:q('output'),outputSpeed:speed('output'),contacts,connectionErrors:[0,2].map(i=>Math.hypot(...pos(sites[i]).map((x,k)=>x-pos(sites[i+1])[k]))),qpos:Array.from(p.data.qpos),qvel:Array.from(p.data.qvel)};
 }});
}
