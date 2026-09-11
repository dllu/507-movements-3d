import fs from 'node:fs';import crypto from 'node:crypto';
import {makeAlternatingPegCandidate} from './lib/alternating-peg-candidate.mjs';
import {makeAlternatingPegDynamics} from './lib/alternating-peg-dynamics-study.mjs';
import {add,sub,mul,dot,rotate,pegPawlProfile} from './lib/alternating-peg-contact-study.mjs';

const trajectoryFile=process.env.PROBE_TRAJECTORY||'artifacts/review/077-contact-fit-short-lip.json',trajectory=JSON.parse(fs.readFileSync(trajectoryFile)),
 candidate=makeAlternatingPegCandidate(trajectory.geometry),physics=makeAlternatingPegDynamics(candidate,trajectory.parameters),
 p=candidate.root.userData.geometry,mass=physics.parameters.mass,profiles=Object.fromEntries(['upper','lower'].map(k=>[k,pegPawlProfile(candidate.root.userData.profiles[k])])),
 rows=[],failures=[],totals={inputWork:0,constantLoadWork:0,dampingWork:0,frictionWork:0,defect:0,positiveDefect:0};
const energy=state=>{
 const input=physics.input(state.time),bodies={};let kinetic=.5*mass.wheel.I*state.v[0]**2,potential=0;
 for(const [j,key]of ['upper','lower'].entries()){
  const m=mass[key],r=rotate(m.c,state.x[j+1]),pivot=input.pawls[key],velocity=add(pivot.velocity,mul([-r[1],r[0]],state.v[j+1])),
   central=m.I-m.m*dot(m.c,m.c),position=add(pivot.pivot,r);
  kinetic+=.5*m.m*dot(velocity,velocity)+.5*central*state.v[j+1]**2;potential+=9.81*m.m*position[1];bodies[key]={velocity,pivot};
 }
 return{kinetic,potential,total:kinetic+potential,bodies};
};
let first=energy(trajectory.rows[0]),previous=first,minimumDefect=0,maximumPositiveDefect=0;
for(let i=1;i<trajectory.rows.length;i++){
 const state=trajectory.rows[i],old=trajectory.rows[i-1],dt=state.time-old.time,current=energy(state),contactImpulses={upper:[0,0],lower:[0,0]};
 for(const contact of state.contacts){
  const [key,pinIndex,featureIndex]=contact.id.split(':'),pin=candidate.motion.pinAt(Number(pinIndex),state.x[0]),j=key==='upper'?1:2,
   local=rotate(sub(pin,current.bodies[key].pivot.pivot),-state.x[j]),f=profiles[key].features(local)[Number(featureIndex)],normal=rotate(f.normal,state.x[j]);
  contactImpulses[key]=add(contactImpulses[key],mul(normal,-contact.impulse));
 }
 let inputWork=0;
 for(const key of ['upper','lower']){
  const m=mass[key],now=current.bodies[key],before=previous.bodies[key],pivotImpulse=sub(add(mul(sub(now.velocity,before.velocity),m.m),[0,9.81*m.m*dt]),contactImpulses[key]);
  inputWork+=dot(now.pivot.velocity,pivotImpulse);
 }
 const constantLoadWork=-physics.parameters.load*(state.x[0]-old.x[0]),dampingWork=-dt*physics.parameters.damping.reduce((sum,d,j)=>sum+d*state.v[j]**2,0),
  frictionWork=(state.frictionImpulse??0)*state.v[0],defect=current.total-previous.total-inputWork-constantLoadWork-dampingWork-frictionWork,
  values={inputWork,constantLoadWork,dampingWork,frictionWork,defect,positiveDefect:Math.max(0,defect)};
 for(const[key,value]of Object.entries(values))totals[key]+=value;
 minimumDefect=Math.min(minimumDefect,defect);maximumPositiveDefect=Math.max(maximumPositiveDefect,defect);
 if(frictionWork>1e-8)failures.push({time:state.time,reason:'friction-added-energy',frictionWork});
 if(!Number.isFinite(defect))failures.push({time:state.time,reason:'nonfinite-energy-balance'});
 if(i%25===0)rows.push({time:state.time,energy:current.total,...values});previous=current;
}
const output=process.env.PROBE_OUTPUT||'artifacts/review/077-short-lip-energy-study.json',files=[trajectoryFile,'scripts/assess-alternating-peg-energy.mjs','scripts/lib/alternating-peg-candidate.mjs','scripts/lib/alternating-peg-dynamics-study.mjs','scripts/lib/alternating-peg-contact-study.mjs'],
 report={movement:77,productionChanged:false,mechanicsPassed:false,status:'exploratory-energy-balance',trajectoryFile,dt:trajectory.dt,steps:trajectory.rows.length-1,
  initialEnergy:first.total,finalEnergy:previous.total,totals,minimumDefect,maximumPositiveDefect,failures,rows,
  qualification:'Tracks kinetic and gravitational energy of the wheel and two pawls. Prescribed-pivot work is reconstructed from their linear impulse balances. Angular damping acts on absolute angular rates. End-step work is used for impulses, including bidirectional dry friction. Negative defects may include inelastic impact loss; positive defects require time-step convergence assessment. The driven lever energy lies outside this free-body scope.',
  sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log({output,steps:report.steps,totals,maximumPositiveDefect,minimumDefect,failures:failures.length});if(failures.length)process.exitCode=1;
