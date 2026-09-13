import fs from 'node:fs';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoWormSaddle} from '../src/simulation/mujoco-worm-saddle/visual.js';
import {inspectWeightedClutchSolid} from './lib/weighted-clutch-solid-audit.mjs';
const cut=process.env.HOB_FILE?JSON.parse(fs.readFileSync(process.env.HOB_FILE)):undefined;
const options=JSON.parse(process.env.SIM_OPTIONS??'{}'),mujoco=await loadMujoco(),start=performance.now();
const v=makeMujocoWormSaddle(mujoco,{cut,...options}),u=v.root.userData,p=v.physics,f=u.profile,rows=[];
try {
  const topology=Object.fromEntries(Object.entries(u.parts).map(([n,m])=>[n,inspectWeightedClutchSolid(m.geometry)]));
  console.log({coupling:p.description.coupling,geoms:p.model.ngeom,compileSeconds:(performance.now()-start)/1000,topology:Object.fromEntries(Object.entries(topology).map(([n,a])=>[n,{components:a.components,degenerate:a.degenerate,unmatched:a.unmatchedEdges,wrongNormals:a.wrongNormals}]))});
  const duration=Number(process.env.DURATION??8),n=Math.round(duration/p.timestep);
  for(const mode of ['worm','wheel']){
    u.setConfiguration(mode);let maximumError=0;
    for(let i=0;i<=n;i++){
      if(i)p.step();const q=Array.from(p.data.qpos);assert.ok([...q,...p.data.qvel].every(Number.isFinite));
      maximumError=Math.max(maximumError,Math.abs(q[1]+f.lead*q[0]-f.pitchRadius*q[2]));
      if(i%Math.round(.5/p.timestep)===0){v.sync();const row={...u.state,ncon:p.data.ncon};rows.push(row);console.log(row);}
    }console.log({mode,meshPhaseErrorPixels:maximumError*100});
  }
  if(process.env.PROBE_PREFIX)fs.writeFileSync(process.env.PROBE_PREFIX+'.json',JSON.stringify({options,topology,rows},null,2)+'\n',{flag:'wx'});
}finally{v.dispose();}
