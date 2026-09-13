import fs from 'node:fs';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoTriangularEccentric} from '../src/simulation/mujoco-triangular-eccentric/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/091-mujoco';
const seconds=Number(process.env.PROBE_SECONDS??40),options=JSON.parse(process.env.PROBE_OPTIONS??'{}');
const paths=['src/simulation/mujoco-triangular-eccentric','src/simulation/mujoco']
  .flatMap(dir=>fs.readdirSync(dir).filter(n=>n.endsWith('.js')).map(n=>dir+'/'+n));
paths.push('src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js',
  'src/simulation/triangular-eccentric-profile.js','src/simulation/cubic-polyline.js',
  'src/simulation/primitives.js','src/simulation/dispose-model.js','scripts/probe-mujoco-triangular-eccentric.mjs',
  'scripts/lib/study-report-io.mjs','package-lock.json');
const sources=freezeStudySources(paths,prefix),mujoco=await loadMujoco();
const v=makeMujocoTriangularEccentric(mujoco,options),p=v.physics,u=v.root.userData,rows=[],dwells=new Map();
let maximumError=0,minimumContact=0,activeSteps=0,maximumStep=0,previous=p.data.qpos[1];
const started=performance.now();
try {
  for(let i=1;i<=Math.round(seconds/p.timestep);i++) {
    p.step();const [angle,y]=p.data.qpos;
    assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
    const ideal=(u.profile.extreme(angle).value+u.profile.extreme(angle,-1).value)/2;
    maximumError=Math.max(maximumError,Math.abs(y-ideal));maximumStep=Math.max(maximumStep,Math.abs(y-previous));previous=y;
    const halfTurn=Math.round(angle/Math.PI);
    if(Math.abs(angle-halfTurn*Math.PI)<u.profile.dwellHalfAngle-.08) {
      const values=dwells.get(halfTurn)??[Infinity,-Infinity];values[0]=Math.min(values[0],y);values[1]=Math.max(values[1],y);dwells.set(halfTurn,values);
    }
    if(p.data.ncon) {
      activeSteps++;const contacts=p.data.contact;
      for(let j=0;j<contacts.size();j++){const c=contacts.get(j);minimumContact=Math.min(minimumContact,c.dist);c.delete();}contacts.delete();
    }
    if(i%Math.round(.01/p.timestep)===0)rows.push({time:p.data.time,qpos:Array.from(p.data.qpos),qvel:Array.from(p.data.qvel)});
  }
  verifyStudySources(sources);
  const report={sources,options:{...p.description.options,chordTolerance:u.geometry.chordTolerance},seconds:p.data.time,
    wallSeconds:(performance.now()-started)/1000,camVertices:u.profiles.cam.length,maximumSupportDifferencePixels:maximumError*100,
    maximumNativePenetrationPixels:-minimumContact*100,maximumDwellSpanPixels:Math.max(...[...dwells.values()].map(([a,b])=>(b-a)*100)),
    maximumYokeStep:maximumStep,activeSteps,rows};
  fs.writeFileSync(prefix+'.json',JSON.stringify(report)+'\n',{flag:'wx'});console.log({...report,sources:sources.length,rows:rows.length});
} finally {v.dispose();}
