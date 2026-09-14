import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeBowDrillGeometry} from '../src/simulation/mujoco-bow-drill/geometry.js';
import {makeBowDrillPhysics} from '../src/simulation/mujoco-bow-drill/physics.js';
import {makeBowDrillContactAudit} from './lib/bow-drill-contact-audit.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/124-links';
const options=JSON.parse(process.env.SIM_OPTIONS??'{}'),duration=Number(process.env.DURATION??12.25);
if(!(Number.isFinite(duration)&&duration>0))throw Error('Invalid study duration');
const sources=freezeStudySources(['scripts/probe-bow-drill-links.mjs','scripts/lib/bow-drill-contact-audit.mjs',
  ...fs.readdirSync('src/simulation/mujoco-bow-drill').filter(n=>n.endsWith('.js')).map(n=>'src/simulation/mujoco-bow-drill/'+n),
  'src/simulation/mujoco/mass.js','src/simulation/mujoco/simulation.js','src/simulation/finite-plate-geometry.js',
  'src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','src/simulation/dispose-model.js',
  'scripts/lib/study-report-io.mjs','package-lock.json'],prefix);
const visual=makeBowDrillGeometry(options),mj=await loadMujoco();
let p,audit;
try {
  p=makeBowDrillPhysics(mj,visual,{...options,cordModel:'linked'});
  audit=makeBowDrillContactAudit(p);
  const {joints:j,data:d}=p,rows=[],range=[Infinity,-Infinity],start=performance.now();
  let logTime=start,penetration=0,closure=0,pinError=0,resets=0,previous=0,inputError=0,torqueResidual=0;
  let forceSum=0,slipSum=0,centerSlipSum=0,maximumSpindleActuation=0,completedSteps=0;
  fs.writeFileSync(prefix+'.xml',p.description.xml,{flag:'wx'});
  console.log({compiled:true,nv:p.model.nv,neq:p.model.neq});
  for(let i=0;i<Math.ceil(duration/p.timestep);i++) {
    p.step();completedSteps++;
    if(![...d.qpos,...d.qvel].every(Number.isFinite))throw Error('Nonfinite linked cord state');
    if(d.time<previous){resets++;break;}previous=d.time;
    const spin=d.qpos[j.spin.q];range[0]=Math.min(range[0],spin);range[1]=Math.max(range[1],spin);
    maximumSpindleActuation=Math.max(maximumSpindleActuation,Math.abs(d.qfrc_actuator[j.spin.v]));
    inputError=Math.max(inputError,Math.abs(d.qpos[j.drive.q]-p.description.input(d.time).position));
    // mj_step's contact positions precede integration. Synchronize them only at
    // logged samples; all metrics in a row then refer to the same physical state.
    if((i+1)%Math.max(1,Math.round(.01/p.timestep))===0) {
      mj.mj_forward(p.model,d);
      const a=audit.sample();
      penetration=Math.max(penetration,a.penetration);closure=Math.max(closure,a.closure);pinError=Math.max(pinError,a.pinError);
      torqueResidual=Math.max(torqueResidual,Math.abs(a.torqueResidual));
      if(d.time>=1){forceSum+=a.normalForce;slipSum+=a.slipSquared;centerSlipSum+=a.centerSlipSquared;}
      rows.push({time:d.time,spin,drive:d.qpos[j.drive.q],tension:d.qpos[j.tension.q],
        spinVelocity:d.qvel[j.spin.v],driveVelocity:d.qvel[j.drive.v],contacts:d.ncon,audit:a,
        points:p.getCordPoints()});
    }
    if(performance.now()-logTime>5000){logTime=performance.now();console.log({time:d.time,wallSeconds:(logTime-start)/1000,spin});}
  }
  verifyStudySources(sources);
  const report={sources,options:p.description.options,geometryOptions:options,duration,achievedTime:d.time,completedSteps,range,
    maximumPenetrationPixels:100*penetration,maximumClosurePixels:100*closure,maximumPinErrorPixels:100*pinError,
    maximumInputErrorPixels:100*inputError,maximumSpindleActuation,maximumContactTorqueResidual:torqueResidual,
    forceWeightedCircumferentialSlip:forceSum?Math.sqrt(slipSum/forceSum):null,
    forceWeightedSlipWithoutSectionRotation:forceSum?Math.sqrt(centerSlipSum/forceSum):null,
    timeResets:resets,wallSeconds:(performance.now()-start)/1000,rows,
    qualification:p.description.assumptions+' Contacts and connections sampled every 0.01 s. Force-weighted slip excludes the first second. The comparison removes section rotation only from the velocity diagnostic; it does not alter the simulation.'};
  fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log({...report,sources:sources.length,rows:rows.length});
  if(resets)throw Error('MuJoCo reset during the study; failed trajectory retained');
}finally{audit?.dispose();p?.dispose();disposeObject3D(visual.root);}
