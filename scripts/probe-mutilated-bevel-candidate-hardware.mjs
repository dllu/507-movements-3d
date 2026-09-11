import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeMutilatedBevelCandidate } from './lib/mutilated-bevel-candidate.mjs';
import { applySectorRelief } from './lib/mutilated-bevel-tooth-relief.mjs';
import { prepareBevelSurfaces, sampleBevelPair } from './lib/bevel-working-surfaces.mjs';
import { setSpin } from '../src/simulation/primitives.js';

const motionFile=process.argv[2]??'artifacts/review/074-release-refined-motion-1440.json',motion=JSON.parse(await readFile(motionFile,'utf8')),
  relief=JSON.parse(await readFile(motion.relief,'utf8')),model=makeMutilatedBevelCandidate(relief.parameters);applySectorRelief(model,relief);
const {blocks:b,geometry:p}=model.root.userData,prepared=Object.fromEntries(Object.entries(b).map(([name,gear])=>[name,prepareBevelSurfaces(gear)]));
const base=motion.rows[motion.steps*(motion.cycles-1)].coordinate;
const angleAt=coordinate=>{
  const relative=coordinate-base,cycles=Math.floor(relative),index=Math.round((relative-cycles)*motion.steps);
  if(Math.abs(index/motion.steps-(relative-cycles))>1e-9)throw new Error('Hardware poses must coincide with motion knots');
  return motion.rows[motion.steps*(motion.cycles-1)+index].angle+cycles*Math.PI*p.ratio;
};
const indices=new Set(Array.from({length:241},(_,i)=>Math.round(i*motion.steps/240)));
for(const row of motion.rows.filter(r=>r.step>=motion.steps*(motion.cycles-1))){
  const phase=((row.coordinate%1)+1)%1;
  if(Math.min(Math.abs(phase-.4875),Math.abs(phase-.9875))<.03)indices.add(row.step-motion.steps*(motion.cycles-1));
}
const rows=[],pairs=[['gearA','driverC'],['driverC','gearA'],['gearB','driverC'],['driverC','gearB'],['gearA','gearB'],['gearB','gearA']];
for(const index of [...indices].sort((a,b)=>a-b)){
  const coordinate=base+index/motion.steps;model.update((coordinate-p.initialCyclePhase)*p.period);
  setSpin(b.gearA,angleAt(coordinate));setSpin(b.gearB,angleAt(coordinate+.5));model.root.updateMatrixWorld(true);
  const boxes=Object.fromEntries(Object.entries(b).map(([name,gear])=>[name,new THREE.Box3().setFromObject(gear)]));
  for(const [first,last]of pairs){
    const a=boxes[first],c=boxes[last],delta=['x','y','z'].map(axis=>Math.max(0,a.min[axis]-c.max[axis],c.min[axis]-a.max[axis])),lowerBound=Math.hypot(...delta);
    const result=lowerBound>.08?{gap:lowerBound,checks:0,inside:0,boxSeparated:true}:sampleBevelPair(prepared[first],prepared[last]);
    rows.push({coordinate,first,last,...result});
  }
}
const report={movement:74,status:'isolated-contact-motion-hardware-audit',productionChanged:false,motionFile,poses:indices.size,rows,
  checks:rows.reduce((s,r)=>s+r.checks,0),inside:rows.reduce((s,r)=>s+r.inside,0),minimumGap:Math.min(...rows.map(r=>r.gap)),
  qualification:'Actual Float32 vertices, triangle-edge midpoints and face centers, both directions for all three independent rigid families: A, B and C. Each family includes its turned body/shaft and every installed tooth. Axis-aligned world boxes reject separated pairs conservatively. B uses the A solution a half-input-turn later: a world half-turn about the vertical axis maps the A/C assembly to B/C, with the C pose identical modulo one full turn. Samples use actual motion knots; between-knot interpolation and continuous swept clearance remain separate checks. Same-family integral root joins are permitted. Penetration threshold is 1e-6.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/074-contact-motion-hardware.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:report.poses,checks:report.checks,inside:report.inside,minimumGap:report.minimumGap});
if(report.inside)process.exitCode=1;
