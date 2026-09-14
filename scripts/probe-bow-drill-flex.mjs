import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeBowDrillGeometry} from '../src/simulation/mujoco-bow-drill/geometry.js';
import {makeBowDrillPhysics} from '../src/simulation/mujoco-bow-drill/physics.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/124-flex';
const options={...JSON.parse(process.env.SIM_OPTIONS??'{}'),cordModel:'flex'},duration=Number(process.env.DURATION??12.25);
const sources=freezeStudySources(['scripts/probe-bow-drill-flex.mjs',
  ...fs.readdirSync('src/simulation/mujoco-bow-drill').filter(n=>n.endsWith('.js')).map(n=>'src/simulation/mujoco-bow-drill/'+n),
  'src/simulation/mujoco/mass.js','src/simulation/mujoco/simulation.js','src/simulation/dispose-model.js',
  'src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js',
  'src/simulation/primitives.js','scripts/lib/study-report-io.mjs','package-lock.json'],prefix);
const visual=makeBowDrillGeometry(options),u=visual.root.userData,f=u.profile,mj=await loadMujoco();
const p=makeBowDrillPhysics(mj,visual,options),j=p.joints;
fs.writeFileSync(prefix+'.xml',p.description.xml,{flag:'wx'});
try {
  const rows=[],ranges={spin:[Infinity,-Infinity],tension:[Infinity,-Infinity]};
  let penetration=0,strain=0,inputError=0,resets=0,previous=0,maxActuatedSpinForce=0;
  const start=performance.now();let lastLog=start;
  console.log({compiled:true,nv:p.model.nv,nflex:p.model.nflex,segments:f.cordSegments});
  for(let i=0;i<Math.ceil(duration/p.timestep);i++) {
    p.step();if(![...p.data.qpos,...p.data.qvel].every(Number.isFinite))throw Error('Nonfinite flex state');
    if(p.data.time<previous)resets++;previous=p.data.time;
    for(const n of Object.keys(ranges)){const q=p.data.qpos[j[n].q];ranges[n][0]=Math.min(ranges[n][0],q);ranges[n][1]=Math.max(ranges[n][1],q);}
    inputError=Math.max(inputError,Math.abs(p.data.qpos[j.drive.q]-p.description.input(p.data.time).position));
    maxActuatedSpinForce=Math.max(maxActuatedSpinForce,Math.abs(p.data.qfrc_actuator[j.spin.v]));
    for(let k=0;k<p.description.lengths.length;k++)strain=Math.max(strain,Math.abs(p.data.flexedge_length[k]/p.description.lengths[k]-1));
    const cs=p.data.contact;try{for(let k=0;k<cs.size();k++){const c=cs.get(k);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{cs.delete();}
    if(i%Math.max(1,Math.round(.05/p.timestep))===0){mj.mj_forward(p.model,p.data);rows.push({time:p.data.time,spin:p.data.qpos[j.spin.q],spinVelocity:p.data.qvel[j.spin.v],drive:p.data.qpos[j.drive.q],tension:p.data.qpos[j.tension.q],contacts:p.data.ncon,points:Array.from({length:f.cordSegments+1},(_,k)=>Array.from(p.data.flexvert_xpos.slice(3*k,3*k+3)))});}
    if(performance.now()-lastLog>5000){lastLog=performance.now();console.log({time:p.data.time,wallSeconds:(lastLog-start)/1000,penetrationPixels:100*penetration,maximumEdgeStrain:strain});}
  }
  const report={sources,options:p.description.options,geometryOptions:options,duration,
    masses:p.description.masses,density:p.description.density,cordDensity:p.description.cordDensity,
    cordRadius:f.cordRadius,drumRadius:f.drumRadius,pitchRadius:f.pitchRadius,
    model:{nv:p.model.nv,nflex:p.model.nflex,ngeom:p.model.ngeom,neq:p.model.neq,nu:p.model.nu},
    ranges,maximumPenetrationPixels:100*penetration,maximumEdgeStrain:strain,
    maximumInputErrorPixels:100*inputError,maxActuatedSpinForce,timeResets:resets,
    wallSeconds:(performance.now()-start)/1000,rows,
    qualification:p.description.assumptions};
  verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log({...report,sources:sources.length,rows:rows.length});
} finally {p.dispose();disposeObject3D(visual.root);}
