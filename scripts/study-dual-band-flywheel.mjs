import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeDualBandContactStudy} from '../src/simulation/mujoco-dual-band/physics.js';
const path=process.argv[2]??'/dev/shm/390-passive-study.json',options=JSON.parse(process.argv[3]??'{}'),duration=options.duration??24, sampleStep=options.sampleStep??.01;
delete options.duration;delete options.sampleStep;
const mujoco=await loadMujoco(),p=makeDualBandContactStudy(mujoco,options),samples=[],minimum={gap:Infinity};let maxCarrierError=0;
try{
  const steps=Math.round(duration/p.timestep),stride=Math.max(1,Math.round(sampleStep/p.timestep));
  for(let i=0;i<=steps;i++){
    if(i%stride===0){const state=p.state();samples.push(state);const target=p.description.input(state.time).angle;maxCarrierError=Math.max(maxCarrierError,Math.abs(state.q[0]-target),Math.abs(state.q[2]+target));
      const contacts=p.data.contact;try{for(let j=0;j<p.data.ncon;j++){const c=contacts.get(j);try{if(c.dist<minimum.gap){minimum.gap=c.dist;minimum.time=state.time;minimum.pair=[c.geom1,c.geom2].map(id=>mujoco.mj_id2name(p.model,mujoco.mjtObj.mjOBJ_GEOM.value,id));}}finally{c.delete();}}}finally{contacts.delete();}
    }
    if(i<steps)p.step();
  }
  const final=samples.at(-1),last=samples.filter(s=>s.time>duration-8-1e-6),summary={options:p.description.options,duration,maxCarrierError,minimum,final,
    lastCycleAdvance:last.at(-1).q[4]-last[0].q[4],lastCycleMinimumSpeed:Math.min(...last.map(s=>s.v[4])),lastCycleMaximumSpeed:Math.max(...last.map(s=>s.v[4])),
    pawlRanges:[1,3].map(j=>[samples.reduce((a,s)=>Math.min(a,s.q[j]),Infinity),samples.reduce((a,s)=>Math.max(a,s.q[j]),-Infinity)])};
  fs.writeFileSync(path,JSON.stringify({summary,samples},null,2)+'\n');fs.writeFileSync(path.replace(/\.json$/,'.xml'),p.description.xml);console.log(summary);
}finally{p.dispose();}
