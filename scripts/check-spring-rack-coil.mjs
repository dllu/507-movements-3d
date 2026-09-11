import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {makeSpringRackCoil} from './lib/spring-rack-coil.mjs';
const input='artifacts/review/081-interval-finer-dynamics.json',data=JSON.parse(fs.readFileSync(input)),candidate=makeSpringRackCandidate(data.geometry),
 p=candidate.root.userData.geometry,sourceRecord=JSON.parse(fs.readFileSync('artifacts/review/081-fitted-loaded-captures.json')).sources.find(r=>r.file.endsWith('/spring-rack-coil.mjs')),
 oldText=fs.readFileSync(sourceRecord.archive,'utf8').replace("from 'three'","from "+JSON.stringify(import.meta.resolve('three'))),
 oldFactory=(await import('data:text/javascript;base64,'+Buffer.from(oldText).toString('base64'))).makeSpringRackCoil,
 args={...p.spring,referenceSpan:p.spring.top-p.spring.bottom-2*p.spring.wireRadius},old=oldFactory(args),current=makeSpringRackCoil(args),
 range=[Math.min(...data.rows.map(r=>r.x[0])),Math.max(...data.rows.map(r=>r.x[0]))],states=[0,...Array.from({length:11},(_,i)=>range[0]+i*(range[1]-range[0])/10)],
 comparisons=[],topology=[],issues=[];
for(const y of states){
 old.update(p.spring.bottom+y,p.spring.top,p.spring.axisX,p.spring.axisZ);current.update(p.spring.bottom+y,p.spring.top,p.spring.axisX,p.spring.axisZ);
 const a=old.geometry,b=current.geometry,index=b.index;assert.equal(a.attributes.position.count,index.count);
 const error={y,position:0,normal:0};
 for(const name of ['position','normal'])for(let i=0;i<index.count;i++)for(let j=0;j<3;j++)
  error[name]=Math.max(error[name],Math.abs(a.attributes[name].array[3*i+j]-b.attributes[name].array[3*index.getX(i)+j]));
 comparisons.push(error);
 const positions=b.attributes.position,normals=b.attributes.normal,edges=new Map();let volume=0,degenerate=0,wrongNormals=0;
 for(let i=0;i<index.count;i+=3){
  const ids=[0,1,2].map(j=>index.getX(i+j)),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(positions,j)),
   cross=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
  if(cross.lengthSq()<1e-22)degenerate++;volume+=v[0].dot(v[1].clone().cross(v[2]))/6;
  if(cross.dot(ids.reduce((sum,j)=>sum.add(new THREE.Vector3().fromBufferAttribute(normals,j)),new THREE.Vector3()))<=0)wrongNormals++;
  const keys=v.map(p=>p.toArray().join(','));for(let j=0;j<3;j++){
   const a=keys[j],b=keys[(j+1)%3],key=a<b?a+'/'+b:b+'/'+a,e=edges.get(key)??{count:0,orientation:0};e.count++;e.orientation+=a<b?1:-1;edges.set(key,e);
  }
 }
 const unmatched=[...edges.values()].filter(e=>e.count!==2||e.orientation!==0).length,coil=b.userData.coil;
 topology.push({y,volume,degenerate,wrongNormals,unmatched,lengthError:Math.abs(coil.currentLength-coil.referenceLength)});
 if(degenerate||wrongNormals||unmatched||volume<=0||error.position>1e-7||error.normal>1e-7)issues.push({kind:'indexed-wire-parity-or-topology',y,error,degenerate,wrongNormals,unmatched,volume});
}
const benchmark=coil=>{const count=120,start=performance.now();for(let i=0;i<count;i++)coil.update(p.spring.bottom+range[0]+(range[1]-range[0])*(i%61)/60,p.spring.top,p.spring.axisX,p.spring.axisZ);
 return{updates:count,msPerUpdate:(performance.now()-start)/count};},timing={old:benchmark(old),indexed:benchmark(current)};
// Every triangle is within wireRadius + centerline chord error of the
// analytic centerline. Bound pairs at least half a turn apart across the
// complete span/radius range, rather than checking only rendered poses.
const turns=p.spring.turns,omega=2*Math.PI*turns,N=512,ease=.5/turns,
 height=t=>t<ease?ease*((t/ease)**3-(t/ease)**4/2)/(1-ease):t>1-ease?1-ease*(((1-t)/ease)**3-((1-t)/ease)**4/2)/(1-ease):(t-ease/2)/(1-ease),
 spanMin=args.referenceSpan-range[1],spanMax=args.referenceSpan-range[0],Rmin=current.radiusAt(spanMax),Rmax=current.radiusAt(spanMin),
 curvatureNumerator=Math.hypot(omega*omega*Rmax,spanMax*1.5/ease/(1-ease)),chordError=curvatureNumerator/(8*N*N),
 tubeRadius=p.spring.wireRadius+chordError+5e-7,
 sinMinimum=(lo,hi)=>Math.ceil(lo*turns)<=Math.floor(hi*turns)?0:Math.min(Math.abs(Math.sin(Math.PI*turns*lo)),Math.abs(Math.sin(Math.PI*turns*hi)));
let nonlocalMargin=Infinity,witness=null,pairs=0;
for(let i=0;i<N;i++)for(let j=i+N/(2*turns)+1;j<N;j++){
 const lo=(j-i-1)/N,hi=(j-i+1)/N,radial=2*Rmin*sinMinimum(lo,hi),vertical=spanMin*(height(j/N)-height((i+1)/N)),
  margin=Math.hypot(radial,vertical)-2*tubeRadius;pairs++;
 if(margin<nonlocalMargin){nonlocalMargin=margin;witness={i,j,radial,vertical,margin};}
}
if(nonlocalMargin<=0)issues.push({kind:'nonlocal-coil-clearance',nonlocalMargin,witness});
const prefix='artifacts/review/081-indexed-coil-check',sources=['scripts/check-spring-rack-coil.mjs','scripts/lib/spring-rack-coil.mjs',
 'scripts/lib/spring-rack-candidate.mjs','scripts/lib/spring-rack-source.mjs',sourceRecord.archive,input].map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report={movement:81,status:'indexed-constant-section-coil-check',productionChanged:false,mechanicsPassed:false,passed:issues.length===0,
 comparisons,topology,timing,vertices:{old:old.geometry.attributes.position.count,indexed:current.geometry.attributes.position.count,triangles:current.geometry.index.count/3},
 nonlocal:{pairs,range,spanMin,spanMax,Rmin,Rmax,chordError,tubeRadius,nonlocalMargin,sourcePixelMargin:nonlocalMargin*p.source.scale,witness},issues,sources,
 qualification:'Indexed vertices preserve old triangle positions/normals within the reported tolerance at source plus eleven travel poses, with closed oriented topology and constant centerline quadrature length. Continuous nonlocal tube bounds cover triangle-cell pairs more than half a turn apart; local neighboring surface cells are not certified by this bound. Timings are Node update costs, not browser frame rates. Continuous local folding, timed playback and final visual integration remain pending.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,maximumPositionError:Math.max(...comparisons.map(r=>r.position)),maximumNormalError:Math.max(...comparisons.map(r=>r.normal)),timing,nonlocalMargin,issues});
if(!report.passed)process.exitCode=1;
