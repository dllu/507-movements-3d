import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';
const file='artifacts/review/078-playback-finest-candidate.json',profile=JSON.parse(fs.readFileSync(file)),candidate=makePullPawlCandidate(profile.geometry),
 u=candidate.root.userData,p=u.geometry,box=new THREE.Box3(),parts=Object.entries(u.parts).map(([name,mesh])=>{
 mesh.updateMatrix();const bounds=new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position).applyMatrix4(mesh.matrix),
  family=u.families[name],corners=[[bounds.min.x,bounds.min.y],[bounds.max.x,bounds.min.y],[bounds.max.x,bounds.max.y],[bounds.min.x,bounds.max.y]];
 return{name,family,bounds,corners};
}),rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)],
 add=(a,b)=>a.map((v,i)=>v+b[i]),point=(part,v,row)=>{
  if(part.family==='fixed')return v;
  if(part.family==='lever')return add(p.A,rotate(v,row[1]));
  return add(add(p.A,rotate(p.arms[part.family],row[1])),rotate(v,row[part.family==='left'?3:4]));
 };
for(const part of parts)if(part.family==='wheel'){
 const mesh=u.parts[part.name],pos=mesh.geometry.attributes.position;let radius=0;
 for(let i=0;i<pos.count;i++){const v=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrix);radius=Math.max(radius,Math.hypot(v.x,v.y));}
 box.expandByPoint(new THREE.Vector3(-radius,-radius,part.bounds.min.z));box.expandByPoint(new THREE.Vector3(radius,radius,part.bounds.max.z));
}else if(part.family==='fixed')box.union(part.bounds);
let intervals=0;
for(const table of [profile.first,profile.steady])for(let i=1;i<table.length;i++){
 intervals++;const a=table[i-1],b=table[i],dq=b[1]-a[1];
 for(const part of parts.filter(p=>p.family!=='fixed'&&p.family!=='wheel'))for(const v of part.corners){
  const x=point(part,v,a),y=point(part,v,b),da=part.family==='lever'?dq:b[part.family==='left'?3:4]-a[part.family==='left'?3:4],
   M=(part.family==='lever'?0:Math.hypot(...p.arms[part.family])*dq*dq)+Math.hypot(...v)*da*da,error=M/8+1e-12;
  box.expandByPoint(new THREE.Vector3(Math.min(x[0],y[0])-error,Math.min(x[1],y[1])-error,part.bounds.min.z));
  box.expandByPoint(new THREE.Vector3(Math.max(x[0],y[0])+error,Math.max(x[1],y[1])+error,part.bounds.max.z));
 }
}
const files=[file,'scripts/prepare-pull-pawl-preview.mjs','scripts/lib/pull-pawl-candidate.mjs'],config={movement:78,cacheFile:'/'+file,displayPeriod:4,physicsPeriod:8,
 motionBounds:{min:box.min.toArray(),max:box.max.toArray()},intervals,
 method:'Static parts use their exact mesh boxes. Rotating wheel parts use axis-centered circles containing every Float32 vertex. Each other mesh box is transformed at both ends of every playback interval and expanded by the analytic second-derivative chord error. These conservative bounds cover all intermediate poses and every wheel orientation.',
 sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('artifacts/review/078-preview-config.json',JSON.stringify(config,null,2)+'\n',{flag:'wx'});
console.log({intervals,motionBounds:config.motionBounds});
