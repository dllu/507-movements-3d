import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {surfaceTriangles,surfacePoints,solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-baseline-surfaces',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
const verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};verify();
const model=createMovementModel(readStudyReport('src/data/movements.json').movements[85]),u=model.root.userData,g=u.geometry,b=u.blocks;
const ancestor=(mesh,parent)=>{for(let o=mesh;o;o=o.parent)if(o===parent)return true;return false;};
const names=new Map();for(const[name,block]of Object.entries(b))if(block?.isObject3D)block.traverse(m=>{if(m.isMesh&&!names.has(m))names.set(m,name+(m===block?'':'-'+names.size));});
const parts=[];model.root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible)return;
  const name=names.get(mesh)??'mesh'+parts.length,family=ancestor(mesh,b.catchPivot)?'catch':ancestor(mesh,b.wheel)?'wheel':
    ancestor(mesh,b.cam)||ancestor(mesh,b.inputShaft)?'cam':ancestor(mesh,b.pumpLoad)?'pump':ancestor(mesh,b.freeRope)?'free-rope':'fixed';
  const edges=new Map();let volume=0,degenerate=0;
  for(const t of surfaceTriangles(mesh.geometry)){
    volume+=t.a.dot(t.b.clone().cross(t.c))/6;if(t.getArea()<1e-12)degenerate++;
    const keys=[t.a,t.b,t.c].map(p=>p.toArray().map(v=>Math.round(v*1e8)).join(','));
    for(let i=0;i<3;i++){const a=keys[i],c=keys[(i+1)%3],key=[a,c].sort().join('/'),e=edges.get(key)??{count:0,sign:0};e.count++;e.sign+=a<c?1:-1;edges.set(key,e);}
  }
  const unmatchedEdges=[...edges.values()].filter(e=>e.count!==2||e.sign!==0).length,topology={volume,degenerate,unmatchedEdges,closed:volume>0&&!degenerate&&!unmatchedEdges};
  parts.push({name,mesh,family,topology,points:surfacePoints(mesh.geometry),solid:solidSurface(mesh.geometry)});
});
const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>b.family!==a.family).map(b=>({a,b,checks:0,intrusions:0,maximumDepth:0,worst:null})));
const phases=[...new Set([...Array.from({length:129},(_,i)=>i/128),.12,.23,.34,.365,.39,.55,.68])].sort((a,b)=>a-b);
let boxExclusions=0,openTargetExclusions=0,reportedContactError=0,maximumContactMomentArm=0,minimumTripGap=Infinity,maximumWoundLengthChange=0;
const contactSamples=[];
for(const phase of phases){
  const time=(phase-g.initialCyclePhase)*g.cyclePeriod;model.update(time);model.root.updateMatrixWorld(true);const s=u.stateAtTime(time);
  if(s.camHookContactEngaged){const r=s.camContactPoint.clone().sub(new THREE.Vector2(g.wheelCenter.x,g.wheelCenter.y)),moment=r.x*s.camHookNormal.y-r.y*s.camHookNormal.x;
    maximumContactMomentArm=Math.max(maximumContactMomentArm,Math.abs(moment));reportedContactError=Math.max(reportedContactError,s.camHookContactError);contactSamples.push({phase,moment,normal:s.camHookNormal.toArray(),point:s.camContactPoint.toArray()});}
  minimumTripGap=Math.min(minimumTripGap,s.tripStopGap);maximumWoundLengthChange=Math.max(maximumWoundLengthChange,s.woundRopeLength-g.ropeWoundLengthAtRest);
  for(const p of parts){p.box=p.solid.box.clone().applyMatrix4(p.mesh.matrixWorld);const scale=new THREE.Vector3().setFromMatrixScale(p.mesh.matrixWorld);p.minimumScale=Math.min(...scale.toArray());}
  for(const pair of pairs){
    if(!pair.a.box.intersectsBox(pair.b.box)){boxExclusions++;continue;}
    for(const[a,b]of [[pair.a,pair.b],[pair.b,pair.a]]){
      if(!b.topology.closed){openTargetExclusions++;continue;}
      const transform=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for(const sample of a.points){pair.checks++;const point=sample.clone().applyMatrix4(transform);if(!b.solid.inside(point))continue;
        const depth=b.solid.distance(point)*b.minimumScale;if(depth<=1e-6)continue;pair.intrusions++;
        if(depth>pair.maximumDepth){pair.maximumDepth=depth;pair.worst={phase,time,sampleOn:a.name,inside:b.name,local:point.toArray()};}
      }
    }
  }
}
verify();const sources=freezeStudySources(['scripts/probe-pump-catch-baseline.mjs','src/simulation/authored-intermittent.js','src/simulation/registry.js','src/simulation/primitives.js',
  'src/data/movements.json','tests/helpers/solid-surface.mjs','scripts/lib/study-report-io.mjs'],prefix);verifyStudySources(sources);
const result=pairs.map(({a,b,...p})=>({a:a.name,b:b.name,...p}));
const report={movement:86,status:'existing-loose-wheel-pump-finite-and-torque-diagnostic',productionChanged:false,mechanicsPassed:false,
  meshes:parts.length,topology:parts.map(p=>({name:p.name,family:p.family,...p.topology})),poses:phases.length,pairCount:pairs.length,pairs:result,
  checks:result.reduce((s,p)=>s+p.checks,0),intrusions:result.reduce((s,p)=>s+p.intrusions,0),maximumDepth:Math.max(...result.map(p=>p.maximumDepth)),
  boxExclusions,openTargetExclusions,reportedContactError,maximumContactMomentArm,contactSamples,minimumTripGap,maximumWoundLengthChange,
  constantLiftRequiredTorquePerUnitPumpWeight:g.drumRadius,camPeriod:g.cyclePeriod,displayedCamPeriod:g.cyclePeriod/u.animationTiming.playbackTimeScale,
  frozenProductionInputsMatched:Object.keys(frozen).length,sources,
  qualification:'Actual visible finite surfaces sampled across every independent family, with closed targets only and a conservative world-depth lower bound. Analytic cam contact transmits no shaft-axis torque if its normal is radial; the pump rope requires drum-radius torque per unit weight during constant-speed lift. This is a rejection diagnostic, not a complete contact-force or continuous-clearance qualification.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,topology:report.topology.filter(p=>!p.closed),pairs:result.filter(p=>p.intrusions).sort((a,b)=>b.maximumDepth-a.maximumDepth).slice(0,12),contactSamples:contactSamples.length,sources:undefined});
