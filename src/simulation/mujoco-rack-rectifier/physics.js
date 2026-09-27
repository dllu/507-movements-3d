import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=a=>a.map(v=>Number(v.toPrecision(12))).join(' ');
export function makeRackRectifierPhysics(mujoco,visual,{timestep=.0005,period=6,turnTime=.18,startup=.15,pawlSpring=.001,pawlRest=-.07,pawlDamping=.00005,outputDamping=.00005,friction=0,contactTime=.002,ccdTolerance=1e-6,multiCcd=false,pawlInitial=0,outputInitial=0,backlash=.008}={}){
 if(![timestep,period,turnTime,startup,contactTime,ccdTolerance].every(v=>Number.isFinite(v)&&v>0)||turnTime>=period/4||![pawlSpring,pawlDamping,outputDamping,friction].every(v=>Number.isFinite(v)&&v>=0)||![pawlRest,pawlInitial,outputInitial].every(Number.isFinite)||!(Number.isFinite(backlash)&&backlash>=0&&backlash<.1)||typeof multiCcd!=='boolean')throw new RangeError('Invalid 116 physics options');
 const u=visual.root.userData,f=u.profile,names=['frame','upper','upperPawl','lower','lowerPawl','output'],mass=Object.fromEntries(names.map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.frame.volume,assets=[],geoms=Object.fromEntries(names.map(n=>[n,[]]));
 const inertia=n=>{const m=mass[n];return `<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(v=>v*density))}"/>`;};
 for(const [name,c]of Object.entries(u.cells)){
  const [mask,aff]=name==='upperRack'?[1,2]:name==='lowerRack'?[4,8]:name==='upper'?[2,17]:name==='lower'?[8,20]:name==='upperRatchet'?[32,64]:name==='lowerRatchet'?[128,256]:name==='upperPawl'?[64,32]:name==='lowerPawl'?[256,128]:[16,10];
  c.vertices.forEach((cell,i)=>{const id=name+i;assets.push(`<mesh name="${id}" vertex="${vec(cell.flat())}"/>`);geoms[c.family].push(`<geom name="${id}" type="mesh" mesh="${id}" contype="${mask}" conaffinity="${aff}"/>`);});
 }
 let bodies=`<body name="frame"><joint name="frame" type="slide" axis="1 0 0" damping=".02"/>${inertia('frame')}${geoms.frame.join('')}</body>`;
 for(const name of ['upper','lower'])bodies+=`<body name="${name}"><joint name="${name}" axis="0 0 1" damping=".0001"/>${inertia(name)}${geoms[name].join('')}<body name="${name}Pawl" pos="${vec([...f.pawlPivot,0])}"><joint name="${name}Pawl" axis="0 0 1" stiffness="${pawlSpring}" springref="${pawlRest}" damping="${pawlDamping}"/>${inertia(name+'Pawl')}${geoms[name+'Pawl'].join('')}</body></body>`;
 bodies+=`<body name="output"><joint name="output" axis="0 0 1" damping="${outputDamping}"/>${inertia('output')}${geoms.output.join('')}</body>`;
 const xml=`<mujoco model="116 double rack and ratchet clutches"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 -9.81 0" integrator="discrete" solver="Newton" iterations="80" tolerance="1e-10" cone="elliptic" ccd_tolerance="${ccdTolerance}"><flag multiccd="${multiCcd?'enable':'disable'}" diagexact="enable"/></option><default><geom condim="${friction?3:1}" friction="${friction} .001 .001" solref="${contactTime} 1" solimp=".99 .999 .001"/></default><asset>${assets.join('')}</asset><worldbody>${bodies}</worldbody><actuator><position joint="frame" kp="10000" kv="200"/></actuator></mujoco>`;
 // Pass 86: the nominal stroke is backlash pinion radians longer than a
 // quarter turn each way. The idle pawl then passes the root of the next
 // tooth before its pinion reverses and drops fully into it; the reversed
 // pinion takes up that small backlash (about 0.4 degree of ratchet) before
 // its pawl, already seated, picks up the drive.
 const amplitude=f.amplitude+f.pitchRadius*backlash,speed=4*amplitude/period,input=time=>{
  const decay=Math.exp(-time/startup),t=time-startup*(1-decay),rate=1-decay,phase=((t%period)+period)%period,omega=2*Math.PI/period;
  let position=-amplitude*2/Math.PI*Math.asin(Math.sin(omega*t)),velocity=-speed*Math.sign(Math.cos(omega*t));
  for(const [peak,sign]of [[period/4,-1],[3*period/4,1]]){const d=phase-peak;if(Math.abs(d)<turnTime){const q=d/turnTime;position=sign*(amplitude-speed*turnTime*(3/8+3/4*q*q-1/8*q**4));velocity=-sign*speed*(1.5*q-.5*q**3);}}
  return{position,velocity:velocity*rate,effectiveTime:t};
 };
 const physics=createMujocoSimulation(mujoco,{xml,initialize:({model,data,id})=>{for(const name of ['upperPawl','lowerPawl'])data.qpos[model.jnt_qposadr[id('mjOBJ_JOINT',name)]]=pawlInitial;data.qpos[model.jnt_qposadr[id('mjOBJ_JOINT','output')]]=outputInitial;},beforeStep:({data,time})=>{const s=input(time);data.ctrl[0]=s.position+.02*s.velocity;}}),joints=Object.fromEntries(names.map(n=>{const id=physics.id('mjOBJ_JOINT',n);return[n,{q:physics.model.jnt_qposadr[id],v:physics.model.jnt_dofadr[id]}];}));
 return Object.assign(physics,{joints,bodies:Object.fromEntries(names.map(n=>[n,physics.id('mjOBJ_BODY',n)])),description:{xml,mass,density,input,options:{timestep,period,turnTime,startup,pawlSpring,pawlRest,pawlDamping,outputDamping,friction,contactTime,ccdTolerance,multiCcd,pawlInitial,outputInitial,backlash},stroke:amplitude-speed*turnTime*3/8,assumptions:'Only the frame is actuated. Both pinions, hinged pawls and the common shaft move through native tooth contacts. The pawls have inferred torsion springs. Bearings and the horizontal guide are ideal. Both ratchets drive clockwise in a common coordinate system; viewed from opposite shaft ends their apparent handedness is reversed. Smooth input reversals replace instantaneous stops; uniform shaft speed is an ideal source description, not a prescribed output.'}});
}
