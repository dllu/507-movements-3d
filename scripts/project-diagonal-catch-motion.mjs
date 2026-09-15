import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeDiagonalContactStudy} from '../src/simulation/mujoco-diagonal-catch/contact-study.js';
import {createDiagonalContactProjector} from '../src/simulation/mujoco-diagonal-catch/project-contact.js';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';

const m=await loadMujoco(),sim=makeDiagonalContactStudy(m,{timestep:.00025});
const period=sim.parameters.period,interval=.002,stride=Math.round(interval/sim.timestep),raw=[];
try{
 for(let i=0;i<=2*period/sim.timestep;i++){
  if(i>=period/sim.timestep&&i%stride===0)raw.push({time:i*sim.timestep-period,q:Array.from(sim.data.qpos)});
  if(i<2*period/sim.timestep)sim.step();
 }
}finally{sim.dispose();}
const projector=createDiagonalContactProjector(),keys=[],maximumCorrection=[0,0,0,0];
let failures=0,correctedPoses=0,maxIterations=0;
const first=projector.project(raw[0].q).q;
const smooth=x=>{const v=Math.max(0,Math.min(1,x));return v*v*v*(10+v*(-15+6*v));};
for(const sample of raw){
 // The final half-second is a settled bottom dwell. Remove the tiny residual
 // settling offset there, then recheck finite contact before closing the loop.
 const blend=smooth((sample.time-(period-.5))/.5);
 const input=sample.q.map((v,i)=>v+(first[i]-raw.at(-1).q[i])*blend);
 const result=projector.project(input);
 if(!result.converged)failures++;
 if(result.iterations)correctedPoses++;
 maxIterations=Math.max(maxIterations,result.iterations);
 for(let i=0;i<4;i++)maximumCorrection[i]=Math.max(maximumCorrection[i],Math.abs(result.q[i]-sample.q[i]));
 keys.push([sample.time,...result.q]);
}
const polygonArea=polygons=>polygons.reduce((sum,rings)=>sum+rings.reduce((s,ring,j)=>{
 let area=0;for(let i=0;i<ring.length-1;i++)area+=ring[i][0]*ring[i+1][1]-ring[i+1][0]*ring[i][1];
 return s+(j?-1:1)*Math.abs(area)/2;
},0),0);
let minimumInterpolatedGap=Infinity,maximumIntersectionArea=0,maximumRawIntersectionArea=0,poses=0,independentPoses=0;
for(let i=0;i<keys.length;i++)for(let j=0;j<(i===keys.length-1?1:4);j++){
 const a=keys[i].slice(1),b=(keys[i+1]??keys[i]).slice(1),q=a.map((v,k)=>v+(b[k]-v)*j/4);
 minimumInterpolatedGap=Math.min(minimumInterpolatedGap,projector.clearance(q).distance);poses++;
 if(i%10===0&&j===0){
  const solved=projector.polygons(q),original=projector.polygons(raw[i].q);independentPoses++;
  for(const [a,b]of projector.pairs){
   maximumIntersectionArea=Math.max(maximumIntersectionArea,polygonArea(clip.intersection(solved[a],solved[b])));
   maximumRawIntersectionArea=Math.max(maximumRawIntersectionArea,polygonArea(clip.intersection(original[a],original[b])));
  }
 }
}
const seam=keys[0].slice(1).map((v,i)=>Math.abs(v-keys.at(-1)[i+1]));
const controls={projectionConverges:failures===0,boundedCorrection:maximumCorrection.every(v=>v<.002),
 interpolatedClearance:minimumInterpolatedGap>1e-6,independentPolygonClearance:maximumIntersectionArea<1e-10,
 rawOverlapDetected:maximumRawIntersectionArea>1e-10,closedLoop:seam.every(v=>v<1e-9)};
const sources=['scripts/project-diagonal-catch-motion.mjs','src/simulation/mujoco-diagonal-catch/project-contact.js',
 'src/simulation/mujoco-diagonal-catch/contact-study.js','src/simulation/mujoco-diagonal-catch/catch-profile.js',
 'src/simulation/mujoco-diagonal-catch/handle-fit.js','src/simulation/authored-diagonal-catches.js',
 'src/simulation/mujoco-bench-clamp/profile.js','src/simulation/finite-plate-geometry.js','src/simulation/mujoco/simulation.js'];
const passed=Object.values(controls).every(Boolean),report={movements:[181,182],status:passed?'projected-contact-motion-passed-assembly-unqualified':'projected-contact-motion-failed',
 scope:'Offline candidate contact surfaces only. No complete connecting hardware, production bake, or source-overlay qualification.',
 period,interval,physicsTimestep:sim.timestep,nativeCycle:2,projectionGap:projector.gap,keys:keys.length,correctedPoses,maxIterations,
 maximumCorrection,failures,poses,minimumInterpolatedGap,independentPoses,maximumIntersectionArea,maximumRawIntersectionArea,seam,controls,
 method:'Minimum joint-position corrections along convex separating-axis gradients. Validate interpolated poses every 0.5 ms; independently intersect unsplit polygon unions every 20 ms. Sampled evidence, not continuous collision proof.',
 sources:sources.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('/dev/shm/181-contact-motion.json',JSON.stringify({period,names:['upper','lower','catch','piston'],keys}));
fs.writeFileSync('docs/validation/181-projected-contact-motion.json',JSON.stringify(report,null,2)+'\n');
console.log(report);if(!passed)process.exitCode=1;
