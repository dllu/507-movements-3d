import fs from 'node:fs';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoReverseThread} from '../src/simulation/mujoco-reverse-thread/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/108-native',sources=freezeStudySources([...fs.readdirSync('src/simulation/mujoco-reverse-thread').filter(n=>n.endsWith('.js')).map(n=>'src/simulation/mujoco-reverse-thread/'+n),'scripts/probe-reverse-thread-dynamics.mjs',...fs.readdirSync('src/simulation/mujoco').filter(n=>n.endsWith('.js')).map(n=>'src/simulation/mujoco/'+n),'src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','src/simulation/coaxial-gear-geometry.js','src/simulation/dispose-model.js','scripts/lib/study-report-io.mjs','package-lock.json'],prefix);
const mujoco=await loadMujoco(),options=JSON.parse(process.env.SIM_OPTIONS??'{}'),start=performance.now(),v=makeMujocoReverseThread(mujoco,options),p=v.physics,f=v.root.userData.profile,rows=[];
console.log({compileMilliseconds:performance.now()-start,geoms:p.model.ngeom,nq:p.model.nq,angles:v.root.userData.angles.length});
try {
 const n=Math.round(Number(process.env.DURATION??2*p.description.options.period)/p.timestep);let error=0,penetration=0,contacts=0,speedError=0,inputError=0,previous,maximumError,maximumPenetration,maximumSpeedWindow;const speedWindows=[],window=Math.round(.1/p.timestep);const start=performance.now();
 for(let i=0;i<=n;i++) {
  // mj_step leaves contacts from the pre-integration pose. Keep that pose with
  // any penetration peak instead of pairing the distance with the next pose.
  const contactPose={time:p.data.time,qpos:Array.from(p.data.qpos),qvel:Array.from(p.data.qvel)};
  if(i)p.step();assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
  inputError=Math.max(inputError,Math.abs(p.data.qpos[0]-p.description.omega*p.data.time));
  const expected=f.law(f.initialParameter-p.data.qpos[0]).y-f.initialY;if(Math.abs(p.data.qpos[1]-expected)>error){error=Math.abs(p.data.qpos[1]-expected);maximumError={time:p.data.time,qpos:Array.from(p.data.qpos),expected};}
  if(i%window===0){const derivative=f.law(f.initialParameter-p.data.qpos[0]).derivative,onFlank=Math.abs(Math.abs(derivative)-f.lead)<1e-9;if(onFlank&&previous?.derivative===derivative){const actual=(p.data.qpos[1]-previous.q)/(p.data.time-previous.time),ideal=-p.description.omega*derivative,relativeError=Math.abs((actual-ideal)/ideal),row={start:previous.time,end:p.data.time,actual,ideal,relativeError,startPose:previous.pose,endPose:Array.from(p.data.qpos)};speedWindows.push(row);if(relativeError>speedError){speedError=relativeError;maximumSpeedWindow=row;}}previous=onFlank?{time:p.data.time,q:p.data.qpos[1],derivative,pose:Array.from(p.data.qpos)}:undefined;}
  const cs=p.data.contact;for(let j=0;j<cs.size();j++){const c=cs.get(j);if(-c.dist>penetration){penetration=-c.dist;maximumPenetration={...contactPose,distance:c.dist,geometries:[c.geom1,c.geom2].map(id=>mujoco.mj_id2name(p.model,mujoco.mjtObj.mjOBJ_GEOM.value,id))};}contacts++;c.delete();}cs.delete();
  if(i%Math.round(.25/p.timestep)===0){const row={time:p.data.time,qpos:Array.from(p.data.qpos),expected,errorPixels:100*(p.data.qpos[1]-expected),contacts:p.data.ncon};rows.push(row);console.log(row);}
 }
 const result={sources,options,rows,speedWindows,errorPixels:100*error,penetrationPixels:100*penetration,contacts,speedErrorPercent:100*speedError,inputErrorRadians:inputError,maximumError,maximumPenetration,maximumSpeedWindow,millisecondsPerStep:(performance.now()-start)/n};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log({...result,sources:undefined,rows:undefined,speedWindows:undefined});
}finally{v.dispose();}
