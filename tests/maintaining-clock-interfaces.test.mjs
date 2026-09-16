import * as THREE from 'three';
import clip from 'polygon-clipping';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoredMaintainingPowerMovement as chain} from '../src/simulation/authored-maintaining-power.js';
import {createAuthoredGoingBarrelMovement as barrel} from '../src/simulation/authored-going-barrels.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';

for(const id of [320,321])test(`${id}: finite clock interfaces across the winding cycle`,()=>{
  const m=(id===320?chain:barrel)({id,description:''}),r=m.root,b=r.userData.blocks,g=r.userData.geometry;
  const pairs=b.finiteClicks.map(f=>[f.body,f.wheel]);
  if(id===320){
    for(const size of ['small','large'])pairs.push([b[`${size}Axle`],b[`${size}Pulley`].userData.workingBody],[b[`${size}Axle`],b[`${size}Hanger`]]);
  }else pairs.push(...[b.rearBearing,b.greatWheelBody,b.greatWheelHub,b.largeRatchetHub,b.barrelBody,b.ropeDrum,b.barrelRatchet].map(o=>[b.barrelHub,o]),[b.rope,b.ropeDrum],[b.ropeWrap,b.ropeDrum]);
  const solids=new Map(),samples=new Map();for(const[a,c]of pairs){if(!samples.has(a))samples.set(a,surfacePoints(a.geometry));if(!solids.has(c))solids.set(c,solidSurface(c.geometry));}
  const contactRanges=b.finiteClicks.map(()=>[Infinity,0]);
  const closest=(p,a,c)=>{const dx=c[0]-a[0],dy=c[1]-a[1],den=dx*dx+dy*dy;if(!den)return Infinity;const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
  let queries=0,minGap=Infinity;
  for(let i=0;i<=64;i++){
    m.update(g.demonstrationPeriod*i/64);r.updateMatrixWorld(true);
    for(const[fIndex,f]of b.finiteClicks.entries()){
      const transform=f.wheel.matrixWorld.clone().invert().multiply(f.body.matrixWorld),shape=f.body.geometry.parameters.shapes;
      const ring=(Array.isArray(shape)?shape[0]:shape).getPoints(1).map(p=>{const q=new THREE.Vector3(p.x,p.y,0).applyMatrix4(transform);return[q.x,q.y];}),wheel=f.outline;
      const intersection=clip.intersection([[ring]],[[wheel]]);
      const area=intersection.reduce((sum,polygon)=>sum+Math.abs(polygon[0].reduce((a,p,j)=>{const q=polygon[0][(j+1)%polygon[0].length];return a+p[0]*q[1]-p[1]*q[0];},0))/2,0);
      assert.ok(area<1e-10,`${id}/${f.name}, pose ${i}: finite planar click overlap ${area}, polygon ${JSON.stringify(intersection)}`);
      let gap=Infinity;
      for(const[a,c]of [[ring,wheel],[wheel,ring]])for(const p of a)for(let j=0;j<c.length;j++)gap=Math.min(gap,closest(p,c[j],c[(j+1)%c.length]));
      contactRanges[fIndex][0]=Math.min(contactRanges[fIndex][0],gap);contactRanges[fIndex][1]=Math.max(contactRanges[fIndex][1],gap);
      assert.ok(gap<.008,`${id}: detached geometric follower (${gap})`);
    }
    for(const[a,c]of pairs){const transform=c.matrixWorld.clone().invert().multiply(a.matrixWorld),solid=solids.get(c);
      for(const p of samples.get(a)){const q=p.clone().applyMatrix4(transform);queries++;
        if(solid.inside(q))assert.ok(solid.distance(q)<1e-5,`${id}: ${a.userData.role} enters ${c.userData.role} at ${i}: ${solid.distance(q)} (${q.toArray()})`);
        if(b.finiteClicks.some(f=>f.body===a))minGap=Math.min(minGap,solid.distance(q,minGap));
      }
    }
  }
  console.log({id,queries,minGap,contactRanges});
  assert.equal(r.userData.hideGround,true);
  r.traverse(o=>{for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])assert.equal(mat.fog,false);});
});

test('320: actual moving chain clears all four finite grooves without replacing GPU buffers',()=>{
  const m=chain({id:320,description:''}),r=m.root,b=r.userData.blocks,g=r.userData.geometry;
  const bodies=[b.ratchetPulley,b.goingPulley,b.smallPulley,b.largePulley].map(p=>p.userData.workingBody);
  for(const p of [b.ratchetPulley,b.goingPulley,b.smallPulley,b.largePulley])assert.ok(p.userData.rotor.children.filter(o=>/chain-groove/.test(o.userData.role)).every(o=>!o.visible));
  const surfaces=bodies.map(o=>solidSurface(o.geometry)),geometry=b.chainMesh.geometry;
  const buffers=[geometry.attributes.position.array,geometry.attributes.normal.array,geometry.index.array];let queries=0,minGap=Infinity;
  for(let i=0;i<=16;i++){
    m.update(g.demonstrationPeriod*i/16);r.updateMatrixWorld(true);
    const samples=surfacePoints(geometry);
    for(let j=0;j<bodies.length;j++){
      const transform=bodies[j].matrixWorld.clone().invert().multiply(b.chainMesh.matrixWorld),surface=surfaces[j];
      for(const p of samples){const q=p.clone().applyMatrix4(transform);queries++;
        if(surface.inside(q))assert.ok(surface.distance(q)<1e-5,`chain cuts ${bodies[j].userData.role}, pose ${i}, depth ${surface.distance(q)}, point ${q.toArray()}`);
        minGap=Math.min(minGap,surface.distance(q,minGap));
      }
    }
    assert.equal(b.chainMesh.geometry,geometry);
    assert.equal(geometry.attributes.position.array,buffers[0]);assert.equal(geometry.attributes.normal.array,buffers[1]);assert.equal(geometry.index.array,buffers[2]);
  }
  assert.ok(minGap>0&&minGap<.01);
  console.log({id:320,chainQueries:queries,minGap});
});

test('clock clicks have converging tooth-handoff paths and periodic seams',()=>{
  for(const[id,build]of [[320,chain],[321,barrel]]){
    const model=build({id,description:''});
    for(const f of model.root.userData.blocks.finiteClicks){
      const pitch=2*Math.PI/f.wheel.userData.ratchetProfile.teeth,maxima=[];
      for(const N of [256,4096]){
        let previous=f.angleAt(0),maximum=0;
        for(let i=1;i<=N;i++){const value=f.angleAt(pitch*i/N);maximum=Math.max(maximum,Math.abs(value-previous));previous=value;}
        maxima.push(maximum);
      }
      assert.ok(maxima[1]<maxima[0]/4,`${id}/${f.name}: a non-converging follower jump`);
      assert.ok(maxima[1]<.005);assert.ok(Math.abs(f.angleAt(0)-f.angleAt(pitch))<1e-12);
      console.log({id,click:f.name??'p',coarseStep:maxima[0],fineStep:maxima[1]});
    }
  }
});
