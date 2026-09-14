import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3} from 'three';
import {makeTogglePunch} from '../src/simulation/toggle-punch.js';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
const v=makeTogglePunch(),parts=Object.values(v.root.userData.parts).filter(p=>p.geometry.userData.plate&&p.name!=='bored-die-shelf');
const area=p=>p.reduce((sum,p)=>sum+p.reduce((sum,r,k)=>{let a=0;for(let i=0;i<r.length;i++){const b=r[(i+1)%r.length];a+=r[i][0]*b[1]-b[0]*r[i][1];}return sum+(k===0?1:-1)*Math.abs(a)/2;},0),0);
const overlaps={};
try{
 for(let i=0;i<=720;i++){
  const time=6*i/720;v.update(time);
  const shapes=parts.map(p=>{const d=p.geometry.userData.plate;return {mesh:p,low:d.low,high:d.high,polygons:d.polygons.map(polygon=>polygon.map(r=>r.map(([x,y])=>{const v=p.localToWorld(new Vector3(x,y,0));return[v.x,v.y];})))};});
  for(let a=0;a<shapes.length;a++)for(let b=a+1;b<shapes.length;b++){
   const x=shapes[a],y=shapes[b];if(x.mesh.parent===y.mesh.parent||Math.min(x.high,y.high)-Math.max(x.low,y.low)<1e-8)continue;
   const overlap=area(clip.intersection(x.polygons,y.polygons));if(overlap<1e-10)continue;
   const key=x.mesh.name+' / '+y.mesh.name;if(!overlaps[key]||overlap>overlaps[key].area)overlaps[key]={area:overlap,time};
  }
 }
 const report={samples:721,overlaps,note:'Finite extruded plates at overlapping axial depths; same rigid-body pieces excluded. Round shaft and vertical die passage require separate checks.',sources:['src/simulation/toggle-punch.js','src/simulation/toggle-punch-kinematics.js','scripts/review-toggle-punch-clearance.mjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/140-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{v.dispose();}
