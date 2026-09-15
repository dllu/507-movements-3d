import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3} from 'three';
import {cylindricalWormGeometry} from '../src/simulation/worm-gear-geometry.js';
import {boreWormGeometry} from '../src/simulation/bored-worm-geometry.js';
import {circle,poly,polygonClipping} from '../src/simulation/finite-plate-geometry.js';
import {solidSurface,surfaceTriangles} from './helpers/solid-surface.mjs';

test('the worm has an open shaft and key bore without changing its working flanks',()=>{
 const source=cylindricalWormGeometry({pitchRadius:.20875,module:.07,length:4*Math.PI*.07,pressureAngle:Math.PI/9,angularSteps:128});
 const outline=polygonClipping.union(poly(circle([0,0],.058,128)),poly([[-.025,.04],[.025,.04],[.025,.094],[-.025,.094]]))[0][0];
 // polygon-clipping repeats the first vertex at the end of a closed ring.
 outline.pop();
 const bored=boreWormGeometry(source,outline),solid=solidSurface(bored);
 try{
  const length=source.userData.length;
  for(let k=0;k<=24;k++){
   const z=length*(k/24-.5);
   for(let i=0;i<128;i++){
    const a=2*Math.PI*i/128;
    assert.equal(solid.inside(new Vector3(.055*Math.cos(a),.055*Math.sin(a),z)),false,'shaft clearance');
   }
   for(const x of [-.0225,0,.0225])for(const y of [.055,.09])assert.equal(solid.inside(new Vector3(x,y,z)),false,'key clearance');
  }
  assert.equal(solid.inside(new Vector3(.10,0,0)),true,'root material remains around the bore');
  const key=v=>v.toArray().join(',');
  const flankFaces=g=>surfaceTriangles(g).filter(t=>!([t.a,t.b,t.c].every(v=>Math.abs(v.z-length/2)<1e-7)||[t.a,t.b,t.c].every(v=>Math.abs(v.z+length/2)<1e-7))&&[t.a,t.b,t.c].every(v=>Math.hypot(v.x,v.y)>.12)).map(t=>[t.a,t.b,t.c].map(key).join('/'));
  assert.deepEqual(flankFaces(bored),flankFaces(source));
  const normals=bored.attributes.normal,positions=bored.attributes.position;
  const edges=new Map();let volume=0;
  for(let i=0;i<positions.count;i+=3){
   const vertices=[0,1,2].map(j=>new Vector3().fromBufferAttribute(positions,i+j));
   const geometric=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
   if(geometric.lengthSq()<1e-22)continue;
   const stored=new Vector3().fromBufferAttribute(normals,i);
   assert.ok(geometric.dot(stored)>0,'outward stored normals agree with triangle winding');
   volume+=vertices[0].dot(vertices[1].clone().cross(vertices[2]))/6;
   const keys=vertices.map(v=>v.toArray().map(x=>Math.round(x*1e6)).join(','));
   if(new Set(keys).size<3)continue;
   for(let j=0;j<3;j++){
    const a=keys[j],b=keys[(j+1)%3],key=[a,b].sort().join('/'),edge=edges.get(key)??{count:0,direction:0};
    edge.count++;edge.direction+=a<b?1:-1;edges.set(key,edge);
   }
  }
  assert.ok(volume>0,'positive enclosed material volume');
  assert.equal([...edges.values()].filter(e=>e.count!==2||e.direction!==0).length,0,'closed oriented surface at Float32 seam tolerance');
 }finally{source.dispose();bored.dispose();}
});
