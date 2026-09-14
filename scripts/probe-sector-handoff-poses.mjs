import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoSectorHandoff} from '../src/simulation/mujoco-sector-handoff/visual.js';
import {sectorHandoffTravel} from '../src/simulation/mujoco-sector-handoff/profile.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {sectorHandoffStudySources} from './lib/sector-handoff-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/123-poses',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),sources=freezeStudySources(sectorHandoffStudySources('scripts/probe-sector-handoff-poses.mjs'),prefix),mujoco=await loadMujoco(),v=makeMujocoSectorHandoff(mujoco,options),p=v.physics,f=v.root.userData.profile,rows=[],maxima={};
try{
 for(let i=0;i<=720;i++){const theta=i*Math.PI/360,q={left:-theta,center:theta,right:-theta,rack:sectorHandoffTravel(theta,f.R,f.halfSpan).position};for(const[n,x]of Object.entries(q))p.data.qpos[p.joints[n].q]=x;mujoco.mj_forward(p.model,p.data);const pairs={},cs=p.data.contact;
  try{for(let k=0;k<cs.size();k++){const c=cs.get(k);try{const pair=[p.geomGroups[c.geom1],p.geomGroups[c.geom2]].sort().join('/'),depth=-100*c.dist;pairs[pair]=Math.max(pairs[pair]??0,depth);if(!maxima[pair]||depth>maxima[pair].depthPixels)maxima[pair]={theta,depthPixels:depth,pos:[...c.pos]};}finally{c.delete();}}}finally{cs.delete();}rows.push({theta,q,pairs});
 }
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,options,rows,maxima,qualification:'Collision geometry evaluated along an independently imposed nominal path. This can reject incompatible working surfaces; it does not establish that passive native dynamics follow that path.'},null,2)+'\n',{flag:'wx'});console.log(maxima);
}finally{v.dispose();}
