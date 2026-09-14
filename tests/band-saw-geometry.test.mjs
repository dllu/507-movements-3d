import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {makeBandSaw} from '../src/simulation/band-saw.js';
import {bandSawPathDimensions as d} from '../src/simulation/band-saw-path.js';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
test('141 finite ribbon chords clear the wheel at every rotation angle',()=>{
 const v=makeBandSaw(),{parts,geometry:g}=v.root.userData;
 try{
  const p=parts['continuous-blade'].geometry.attributes.position;
  let minimum=Infinity,maximumWheelRadius=0;
  const rim=parts['lower-rim'].geometry.attributes.position;
  for(let i=0;i<rim.count;i++)maximumWheelRadius=Math.max(maximumWheelRadius,Math.hypot(rim.getX(i),rim.getY(i)));
  for(const y of [0,d.spacing])for(let i=0;i<g.stations.length;i++){
   const a=new Vector3().fromBufferAttribute(p,4*i+1),b=new Vector3().fromBufferAttribute(p,4*((i+1)%g.stations.length)+1),dx=b.x-a.x,dy=b.y-a.y;
   const t=Math.max(0,Math.min(1,(-a.x*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));
   minimum=Math.min(minimum,Math.hypot(a.x+t*dx,a.y+t*dy-y));
  }
  assert(minimum>maximumWheelRadius,`ribbon chord cuts wheel: ${maximumWheelRadius-minimum}`);
  assert((minimum-maximumWheelRadius)*100<.01,'contact gap stays visually negligible');
 }finally{v.dispose();}
});
test('141 moving teeth overhang the tread and pass through both table slots',()=>{
 const v=makeBandSaw(),{parts}=v.root.userData;
 try{
  for(let i=0;i<160;i++){
   v.update((i+.371)*12/160);
   const p=parts['moving-saw-teeth'].geometry.attributes.position;
   for(let j=0;j<p.count;j++){
    const x=p.getX(j),y=p.getY(j),z=p.getZ(j);
    assert(z>d.wheelFront,'teeth must clear front of tread');
    if(y>.55&&y<.70){
     assert(Math.abs(Math.abs(x)-.5)<.003);
     assert(z<.105&&z>-.07);
    }
   }
   parts['moving-saw-teeth'].geometry.computeBoundingBox();
   assert(v.root.userData.cameraFitBounds.containsBox(new Box3().setFromObject(v.root,true)));
  }
  const plan=parts['slotted-table'].geometry.userData.plate.polygons;
  // Both complete rectangular straight-run envelopes fit in the actual
  // through-cuts. Blade vertices near the table are constrained above.
  const inside=(point,ring)=>{let n=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++)if((ring[i][1]>point[1])!==(ring[j][1]>point[1])&&point[0]<(ring[j][0]-ring[i][0])*(point[1]-ring[i][1])/(ring[j][1]-ring[i][1])+ring[i][0])n=!n;return n;};
  for(const x of [-.5,.5])for(const dx of [-.0025,0,.0025])for(const z of [-.06,0,.095])assert(!plan.some(poly=>inside([x+dx,z],poly[0])&&!poly.slice(1).some(h=>inside([x+dx,z],h))));
  v.update(1);v.reset();assert.equal(v.root.userData.state.travel,0);
 }finally{v.dispose();}
});
test('141 table seat connects to its pedestal and wheel bores clear the shafts',()=>{
 const v=makeBandSaw(),{parts,wheels}=v.root.userData;
 try{
  const a=parts['table-pedestal'].geometry.userData.plate,b=parts['table-trunnion-seat'].geometry.userData.plate;
  const foot=parts['curved-column'].geometry.userData.plate.polygons[0][0];let contactWidth=0;
  for(let i=0;i<foot.length-1;i++)if(Math.abs(foot[i][1]+.86)<1e-12&&Math.abs(foot[i+1][1]+.86)<1e-12)contactWidth+=Math.abs(foot[i+1][0]-foot[i][0]);
  assert(contactWidth>1,'column has a full-width seat on its base');
  assert(clip.intersection(a.polygons,b.polygons).length>0);
  const seat=new Box3().setFromObject(parts['table-trunnion-seat']),table=new Box3().setFromObject(parts['slotted-table']);assert(seat.intersectsBox(table));
  assert.equal(wheels[1].position.y,3.27);
  const bore=parts['upper-hub'].geometry.userData.plate.polygons[0][1];
  for(let i=0;i<bore.length-1;i++){
   const p=bore[i],q=bore[i+1],dx=q[0]-p[0],dy=q[1]-p[1];if(dx===0&&dy===0)continue;
   assert(Math.abs(dx*p[1]-dy*p[0])/Math.hypot(dx,dy)>.035);
  }
  v.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});
 }finally{v.dispose();}
});
