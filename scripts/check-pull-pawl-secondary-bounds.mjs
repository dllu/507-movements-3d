import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';
import {finitePolygon} from './lib/pull-pawl-contact-study.mjs';
const file=process.env.PLAYBACK_FILE??'artifacts/review/078-playback-finest-candidate.json',cache=JSON.parse(fs.readFileSync(file)),
 candidate=makePullPawlCandidate(cache.geometry),u=candidate.root.userData,p=u.geometry,tolerance=1e-6,roundoff=1e-12,
 add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],
 rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];
const pointSegment=(p,a,b)=>{const d=sub(b,a),square=dot(d,d),t=square?Math.max(0,Math.min(1,dot(sub(p,a),d)/square)):0;return Math.hypot(...sub(p,add(a,d.map(v=>v*t))));},
 segmentDistance=(a,b,c,d)=>{const u=sub(b,a),v=sub(d,c),w=sub(c,a),den=cross(u,v);
  if(Math.abs(den)>1e-18){const s=cross(w,v)/den,t=cross(w,u)/den;if(s>=0&&s<=1&&t>=0&&t<=1)return 0;}
  return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
 };
const parts=Object.entries(u.parts).map(([name,mesh])=>{
 mesh.updateMatrix();const g=mesh.geometry,pos=g.attributes.position,index=g.index,points=[],seen=new Set();let low=Infinity,high=-Infinity;
 for(let i=0;i<pos.count;i++){
  const v=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrix);low=Math.min(low,v.z);high=Math.max(high,v.z);
  const key=[v.x,v.y].join(',');if(!seen.has(key)){seen.add(key);points.push([v.x,v.y]);}
 }
 const min=[0,1].map(k=>Math.min(...points.map(v=>v[k]))),max=[0,1].map(k=>Math.max(...points.map(v=>v[k]))),center=min.map((v,k)=>(v+max[k])/2),
  family=u.families[name];let capsule;
 if(family==='wheel')capsule={a:[0,0],b:[0,0],radius:Math.max(...points.map(v=>Math.hypot(...v))),kind:'axis-circle'};
 else if(Math.max(max[0]-min[0],max[1]-min[1])<1.3*Math.min(max[0]-min[0],max[1]-min[1]))
  capsule={a:center,b:center,radius:Math.max(...points.map(v=>Math.hypot(...sub(v,center)))),kind:'circle'};
 else{
  let xx=0,xy=0,yy=0;for(const v of points){const d=sub(v,center);xx+=d[0]**2;xy+=d[0]*d[1];yy+=d[1]**2;}
  const principal=.5*Math.atan2(2*xy,xx-yy),options=[];
  for(const angle of [0,Math.PI/2,...Array.from({length:41},(_,i)=>principal+(i-20)*.005)]){
   const n=[Math.cos(angle),Math.sin(angle)],t=[-n[1],n[0]],along=points.map(v=>dot(v,n)),side=points.map(v=>dot(v,t)),
    lo=Math.min(...along),hi=Math.max(...along),s=(Math.min(...side)+Math.max(...side))/2,
    a=add(n.map(v=>v*lo),t.map(v=>v*s)),b=add(n.map(v=>v*hi),t.map(v=>v*s)),radius=Math.max(...points.map(v=>pointSegment(v,a,b)));
   options.push({a,b,radius,kind:'capsule'});
  }
  capsule=options.sort((a,b)=>a.radius-b.radius)[0];
 }
 capsule.radius+=roundoff;
 const radialMinimum=center=>{
  let best=Infinity;
  for(let i=0;i<(index?.count??pos.count);i+=3){const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(pos,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrix)).map(v=>sub([v.x,v.y],center)),
    area=cross(sub(v[1],v[0]),sub(v[2],v[0])),signs=v.map((a,k)=>cross(a,v[(k+1)%3]));
   if(Math.abs(area)>1e-18&&(signs.every(s=>s>=0)||signs.every(s=>s<=0)))return 0;
   for(let k=0;k<3;k++)best=Math.min(best,pointSegment([0,0],v[k],v[(k+1)%3]));
  }
  return best;
 };
 return{name,mesh,family,points,low,high,capsule,radialMinimum};
}),byName=Object.fromEntries(parts.map(r=>[r.name,r])),
 boreDefinitions=[['wheelBody','wheelAxle',[0,0],[0,0]],['wheelFrontHub','wheelAxle',[0,0],[0,0]],['wheelRearHub','wheelAxle',[0,0],[0,0]],
 ['rockerB','rockerAxle',[0,0],p.A],['rockerPivotBoss','rockerAxle',[0,0],p.A],['leftPawl','leftPivotPin',[0,0],p.arms.left],['rightPawl','rightPivotPin',[0,0],p.arms.right]],
 pairId=(a,b)=>[a,b].sort().join('/'),bores=new Map(boreDefinitions.map(([bore,shaft,boreCenter,shaftCenter])=>{
  const inner=byName[bore].radialMinimum(boreCenter),outer=Math.max(...byName[shaft].points.map(v=>Math.hypot(...sub(v,shaftCenter))));
  return[pairId(bore,shaft),{bore,shaft,boreCenter,shaftCenter,inner,outer,gap:inner-outer-roundoff}];
 })),frame=finitePolygon(u.parts.frameA.geometry.parameters.shapes[0].getPoints().map(v=>v.toArray())),pairs=[];
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(parts[i].family!==parts[j].family){
 const a=parts[i],b=parts[j],id=pairId(a.name,b.name),zGap=Math.max(a.low-b.high,b.low-a.high);let kind;
 if(zGap>=-tolerance)kind='axial';else if(bores.has(id))kind='bore';
 else if(id==='leftHook/wheelBody'||id==='rightHook/wheelBody')kind='primary-profile';
 else if(a.name==='frameA'||b.name==='frameA')kind='frame-pin';else kind='capsules';
 if(id==='leftPawl/rightPawl')kind='body-profile';
 pairs.push({id,a,b,kind,zGap,minimum:kind==='axial'?zGap:kind==='bore'?bores.get(id).gap:Infinity});
}
const transform=(part,v,row)=>{
 const [,q,theta,left,right]=row;
 if(part.family==='fixed')return v;
 if(part.family==='wheel')return rotate(v,theta);
 if(part.family==='lever')return add(p.A,rotate(v,q));
 return add(add(p.A,rotate(p.arms[part.family],q)),rotate(v,part.family==='left'?left:right));
},speed=(part,rowA,rowB)=>{
 const [,dq,dt,dl,dr]=rowB.map((v,i)=>v-rowA[i]),radius=Math.max(Math.hypot(...part.capsule.a),Math.hypot(...part.capsule.b));
 if(part.family==='fixed'||part.family==='wheel')return 0;
 if(part.family==='lever')return radius*Math.abs(dq);
 return Math.hypot(...p.arms[part.family])*Math.abs(dq)+radius*Math.abs(part.family==='left'?dl:dr);
},evaluate=row=>Object.fromEntries(parts.map(part=>[part.name,{a:transform(part,part.capsule.a,row),b:transform(part,part.capsule.b,row)}])),failures=[];
let intervals=0,maximumBoreCenterError=0;
for(const [label,table]of [['initial',cache.first],['periodic',cache.steady]]){
 let previous=evaluate(table[0]);
 for(let i=1;i<table.length;i++){
  const a=table[i-1],b=table[i],current=evaluate(b);intervals++;
  for(const pair of pairs){
   if(['axial','primary-profile','body-profile'].includes(pair.kind))continue;
   let lower;
   if(pair.kind==='bore'){
    const bore=bores.get(pair.id),error=Math.hypot(...sub(transform(byName[bore.bore],bore.boreCenter,b),transform(byName[bore.shaft],bore.shaftCenter,b)));
    maximumBoreCenterError=Math.max(maximumBoreCenterError,error);lower=bore.gap-error;
   }else if(pair.kind==='frame-pin'){
    const pin=pair.a.name==='frameA'?pair.b:pair.a;
    if(pin.capsule.kind!=='circle'||pin.family!=='lever'){failures.push({reason:'unsupported-frame-pair',id:pair.id});continue;}
    const x=previous[pin.name].a,y=current[pin.name].a,minimum=Math.min(frame.closest(x).gap,frame.closest(y).gap);
    lower=minimum-pin.capsule.radius-speed(pin,a,b)/2-roundoff;
   }else{
    const x=previous[pair.a.name],y=previous[pair.b.name],z=current[pair.a.name],w=current[pair.b.name],
     minimum=Math.min(segmentDistance(x.a,x.b,y.a,y.b),segmentDistance(z.a,z.b,w.a,w.b));
    lower=minimum-pair.a.capsule.radius-pair.b.capsule.radius-(speed(pair.a,a,b)+speed(pair.b,a,b))/2-roundoff;
   }
   if(lower<pair.minimum){pair.minimum=lower;pair.witness={table:label,segment:i-1,time:a[0]};}
  }
  previous=current;
 }
}
for(const pair of pairs)if(!['primary-profile','body-profile'].includes(pair.kind)&&pair.minimum< -tolerance)failures.push({reason:'uncertified-secondary-pair',id:pair.id,kind:pair.kind,minimum:pair.minimum,witness:pair.witness});
const delegateFiles=['artifacts/review/078-playback-finest-contact-bounds.json','artifacts/review/078-pawl-body-clearance-bounds.json'],delegates=delegateFiles.map(path=>{
 const data=JSON.parse(fs.readFileSync(path));if(!data.passed||('turns'in data&&data.turns!==26))throw Error('Incomplete delegated bound: '+path);
 for(const source of data.sources)if(crypto.createHash('sha256').update(fs.readFileSync(source.file)).digest('hex')!==source.sha256)throw Error('Delegated bound source changed: '+source.file);
 if(!data.sources.some(s=>s.file===file))throw Error('Delegated bound uses another playback');return{file:path,passed:data.passed,sha256:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')};
});
const rows=pairs.map(({a,b,...r})=>({...r,a:a.name,b:b.name})),files=[file,...delegateFiles,'scripts/check-pull-pawl-secondary-bounds.mjs','scripts/lib/pull-pawl-candidate.mjs','scripts/lib/pull-pawl-contact-study.mjs'],
 report={movement:78,status:'continuous-secondary-clearance-bounds',productionChanged:false,mechanicsPassed:false,passed:failures.length===0,tolerance,roundoff,
 intervals,pairs:rows,delegates,classification:Object.fromEntries(['axial','bore','primary-profile','body-profile','frame-pin','capsules'].map(k=>[k,rows.filter(r=>r.kind===k).length])),
 bores:[...bores.values()],maximumBoreCenterError,enclosures:parts.map(({name,family,low,high,capsule})=>({name,family,low,high,capsule})),failures,
 method:'Every independent-family pair is assigned a constant axial separation, a concentric bore bound, the separate primary-profile certificate, or a continuous planar enclosure bound. Convex capsules/circles contain every actual Float32 mesh vertex and hence every triangle. Segment-set distance is 1-Lipschitz; minimum endpoint distance minus half the summed endpoint speed bounds the entire linear-angle interval. Wheel enclosures are circles centered exactly on the fixed wheel axis and cover every subsequent orientation. The frame uses its actual filled outer contour against the moving pivot-pin circle. Bore bounds use the minimum radial distance over every projected mesh triangle and the shaft circumradius; bore and shaft centers follow identical kinematic chains.',
 qualification:'The two wheel/hook pairs and the two pawl bodies use separately verified full-profile bounds, whose exact inputs are checked. All 192 independent pairs are covered throughout playback and every wheel orientation; this is not a dynamics certificate.',
 sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(process.env.PROBE_OUTPUT??'artifacts/review/078-secondary-clearance-bounds.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({passed:report.passed,intervals,pairs:pairs.length,classification:report.classification,maximumBoreCenterError,minimumBoreGap:Math.min(...report.bores.map(b=>b.gap)),failures});
if(!report.passed)process.exitCode=1;
