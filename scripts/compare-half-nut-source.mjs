import fs from 'node:fs';
import * as THREE from 'three';
import {makeHalfNutGeometry} from '../src/simulation/mujoco-half-nut/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {halfNutStudySources} from './lib/half-nut-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/110-comparison',input=process.env.SOURCE_REPORT??'/dev/shm/110-source-b.json';
const sources=freezeStudySources([...halfNutStudySources('scripts/compare-half-nut-source.mjs'),input],prefix),measured=JSON.parse(fs.readFileSync(input));
const v=makeHalfNutGeometry(),u=v.root.userData,f=u.profile;
const stats=a=>({count:a.length,rms:Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length),maximum:Math.max(...a.map(Math.abs))});
try {
 const bounds=Object.fromEntries(Object.entries(u.parts).map(([name,m])=>{const b=new THREE.Box3().setFromObject(m,true);return [name,{left:f.axis[0]+100*b.min.x,right:f.axis[0]+100*b.max.x,top:f.axis[1]-100*b.max.y,bottom:f.axis[1]-100*b.min.y}];}));
 const edges={};
 for(const [name,r]of Object.entries(measured.edges)) {
  const side=name==='leftThreadEnd'?'Right':name==='rightThreadStart'?'Left':['Left','Right','Top','Bottom'].find(s=>name.endsWith(s));
  const group=name==='leftThreadEnd'?'leftThread':name==='rightThreadStart'?'rightThread':name.slice(0,-side.length),key=side.toLowerCase();
  const actual=bounds[group==='core'?'rollerShaft':group][key],axis=['Left','Right'].includes(side)?0:1,residuals=r.points.map(p=>actual-p[axis]);
  edges[name]={actual,residuals,...stats(residuals)};
 }
 const report={sources,edges,allEdges:stats(Object.values(edges).flatMap(e=>e.residuals)),qualification:'Actual transformed Float32 mesh extents against sampled ink edges in the initial source pose. Threads use crest extents only; this does not validate each projected thread flank or the hidden half-nut geometry.'};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({allEdges:report.allEdges});
}finally{disposeObject3D(v.root);}
