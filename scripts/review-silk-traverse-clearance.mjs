import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3} from 'three';
import {makeSilkTraverseGeometry} from '../src/simulation/silk-traverse-geometry.js';
import {circle,polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
const v=makeSilkTraverseGeometry(),parts=Object.values(v.root.userData.parts).filter(p=>p.name!=='bored-slider-shoe');
const area=p=>p.reduce((sum,p)=>sum+p.reduce((sum,r,k)=>{let a=0;for(let i=0;i<r.length;i++){const q=r[(i+1)%r.length];a+=r[i][0]*q[1]-q[0]*r[i][1];}return sum+(k===0?1:-1)*Math.abs(a)/2;},0),0);
const overlaps={};
try{
 for(let i=0;i<=720;i++){
  const time=15*i/720;v.update(time);
  const shapes=parts.map(p=>{
   const data=p.geometry.userData,d=data.plate??{low:-data.depth/2,high:data.depth/2,polygons:[[data.outline.map(p=>p.toArray()),circle([0,0],data.boreRadius,64)]]};
   return {mesh:p,low:d.low,high:d.high,polygons:d.polygons.map(poly=>poly.map(r=>r.map(([x,y])=>{const q=p.localToWorld(new Vector3(x,y,0));return[q.x,q.y];})))};
  });
  for(let a=0;a<shapes.length;a++)for(let b=a+1;b<shapes.length;b++){
   const x=shapes[a],y=shapes[b];if(x.mesh.parent===y.mesh.parent||Math.min(x.high,y.high)-Math.max(x.low,y.low)<1e-8)continue;
   const overlap=area(clip.intersection(x.polygons,y.polygons));if(overlap<1e-10)continue;
   const key=x.mesh.name+' / '+y.mesh.name;if(!overlaps[key]||overlap>overlaps[key].area)overlaps[key]={area:overlap,time};
  }
 }
 const report={samples:721,overlaps,note:'Finite plate and gear profiles at overlapping axial depths. Same-body unions excluded; the transverse guide-shoe passage is tested separately.',sources:['src/simulation/silk-traverse-geometry.js','src/simulation/silk-traverse-gears.js','src/simulation/silk-traverse-kinematics.js','scripts/review-silk-traverse-clearance.mjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/142-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{v.dispose();}
