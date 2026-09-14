import test from 'node:test';
import assert from 'node:assert/strict';
import clip from 'polygon-clipping';
import fs from 'node:fs';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[130];
const area=multi=>multi.reduce((sum,poly)=>sum+poly.reduce((s,r,i)=>s+(i?-1:1)*Math.abs(r.reduce((a,p,j)=>{const q=r[(j+1)%r.length];return a+p[0]*q[1]-q[0]*p[1];},0)/2),0),0);
test('131 finite involute sector and rack surfaces clear through a full revolution',()=>{
 const v=createMovementModel(movement),u=v.root.userData,d=u.geometry,p=u.toothProfiles;
 const distance=(p,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y)));return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);};
 const overlap=(angle,phase=0,checkGap=false)=>{
  const s=u.configurationAtInputAngle(angle),rack=u.blocks.rackTeeth.map(t=>p.rack.map(q=>[q.x+t.position.x+s.rackX,q.y-d.sectorPitchRadius]));
  let maximum=0,gap=Infinity;
  for(const t of u.blocks.sectorTeeth){const a=t.rotation.z+s.rockerAngle+phase,c=Math.cos(a),sn=Math.sin(a),ring=p.tooth.map(q=>[q.x*c-q.y*sn,q.x*sn+q.y*c]);
   if(Math.min(...ring.map(q=>q[1]))>-d.sectorPitchRadius+p.module)continue;
   for(const r of rack){maximum=Math.max(maximum,area(clip.intersection([ring],[r])));if(checkGap)for(const q of ring)for(let j=0;j<r.length;j++)gap=Math.min(gap,distance(q,r[j],r[(j+1)%r.length]));}
  }if(checkGap)assert(gap<.004,`working flank gap too large: ${gap}`);return maximum;
 };
 try{
  for(let i=0;i<=720;i++)assert(overlap(i*2*Math.PI/720)<1e-11,`overlap at sample ${i}`);
  for(let i=0;i<=120;i++)overlap(i*2*Math.PI/120,0,true);
  assert(overlap(0,Math.PI/23)>.001,'wrong phase must fail');
  assert.equal(d.cyclePeriod,4);assert.equal(u.hideGround,true);
  for(const mesh of [...u.blocks.sectorTeeth,...u.blocks.rackTeeth])assert.equal(mesh.geometry.parameters.options.bevelSize,0);
 }finally{disposeObject3D(v.root);}
});
