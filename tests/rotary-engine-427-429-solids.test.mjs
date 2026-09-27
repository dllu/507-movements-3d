import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredEccentricShaftRadialPistonEngineMovement} from '../src/simulation/authored-eccentric-shaft-radial-piston-engines.js';
import {createAuthoredRubberLinedRotaryEngineMovement} from '../src/simulation/authored-rubber-lined-rotary-engines.js';
import {createAuthoredDoubleEllipticalRotaryEngineMovement} from '../src/simulation/authored-double-elliptical-rotary-engines.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
function clearCycle(model,pairs) {
  const surfaces=new Map(),points=new Map();
  const query=mesh=>{if(!surfaces.has(mesh))surfaces.set(mesh,solidSurface(mesh.geometry));return surfaces.get(mesh);};
  const samples=mesh=>{if(!points.has(mesh)){const all=surfacePoints(mesh.geometry),stride=Math.max(1,Math.floor(all.length/2000));points.set(mesh,all.filter((_,i)=>i%stride===0));}return points.get(mesh);};
  const checks=pairs.flatMap(([a,b])=>[[a,b],[b,a]]).map(([from,to])=>({from,to,surface:query(to),points:samples(from)}));
  for(let frame=0;frame<=64;frame++){
    model.update(frame*model.root.userData.geometry.cycleDuration/64);model.root.updateMatrixWorld(true);
    for(const {from,to,surface,points}of checks){
      if(!new THREE.Box3().setFromObject(from).intersectsBox(new THREE.Box3().setFromObject(to)))continue;
      const matrix=to.matrixWorld.clone().invert().multiply(from.matrixWorld);
      for(const point of points){const p=point.clone().applyMatrix4(matrix);
        if(surface.inside(p)){const depth=surface.distance(p);assert.ok(depth<3e-7,
          `${from.userData.role} enters ${to.userData.role}: frame ${frame}, depth ${depth}`);}
      }
    }
  }

}

const factories=[[427,createAuthoredEccentricShaftRadialPistonEngineMovement],[428,createAuthoredRubberLinedRotaryEngineMovement],[429,createAuthoredDoubleEllipticalRotaryEngineMovement]];
for(const[id,create]of factories)test(`${id}: finite working walls, mating profiles and joints clear`,()=>{
  const model=create({id}),u=model.root.userData,b=u.blocks;try{
    const pairs=[];
    if(id===427){
      // pass 71: pistons fast on their rings about the cylinder centre slide
      // through rolling packings in the rim of hub C on eccentric shaft B
      const [u1,u2]=b.pistonUnits;
      for(const unit of[u1,u2]){
        for(const fixed of[b.casing,b.back,b.boss,b.rim,b.web,b.shaftB])pairs.push([unit.piston,fixed]);
        pairs.push([unit.ring,b.boss],[unit.ring,b.rim],[unit.ring,b.shaftB],[unit.ring,b.back],[unit.ring,b.web]);
      }
      pairs.push([u1.piston,u2.piston],[u1.piston,u2.ring],[u2.piston,u1.ring],[u1.ring,u2.ring]);
      for(const packing of b.packings){
        for(const other of[b.rim,b.web,b.casing,b.back,u1.piston,u2.piston])pairs.push([packing,other]);
      }
      pairs.push([b.rim,b.casing],[b.rim,b.back],[b.rim,b.boss],[b.shaftB,b.boss],[b.shaftB,b.back],[b.web,b.boss]);
    }else if(id===428){
      // pass 69: rollers on their pins at the arm ends, inside the casing
      const rollerBodies=b.rollers.map(roller=>roller.children[0]);
      const pins=[];model.root.traverse(o=>{if(/^roller-A-\d-pin-on-arm$/.test(o.userData.role))pins.push(o);});
      for(let i=0;i<3;i++)pairs.push([rollerBodies[i],b.arms],[rollerBodies[i],pins[i]],[rollerBodies[i],b.casing],[rollerBodies[i],b.backCover]);
      pairs.push([b.arms,b.casing],[b.arms,b.backCover],[b.shaftB,b.backCover]);
      assert.ok(!solidSurface(rollerBodies[0].geometry).inside(new THREE.Vector3(0,-.5,0)),'roller is genuinely bored');
    }else{
      pairs.push([b.leftPiston,b.rightPiston],[b.leftShaft,b.leftPiston],[b.rightShaft,b.rightPiston]);
      for(const moving of[b.leftPiston,b.rightPiston,...b.leftPackingStrips,...b.rightPackingStrips])pairs.push([moving,b.rearHousing]);
      for(const strip of b.leftPackingStrips)pairs.push([strip,b.rightPiston]);
      for(const strip of b.rightPackingStrips)pairs.push([strip,b.leftPiston]);
    }
    assert.equal(u.hideGround,true);model.root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])assert.equal(material.fog,false);});
    clearCycle(model,pairs);
  }finally{disposeObject3D(model.root);}
});


test('428: the rendered, deforming rubber lining stays outside each roller and inside the bore, touching both',()=>{
  const model=createAuthoredRubberLinedRotaryEngineMovement({id:428});
  try{
    const u=model.root.userData,b=u.blocks,g=u.geometry;let maximumContactGap=0;
    for(let frame=0;frame<=64;frame++){
      model.update(frame*g.cycleDuration/64);model.root.updateMatrixWorld(true);
      const positions=b.rubber.geometry.attributes.position,count=g.samples;
      // vertex block 0 is the inner face at the front
      const inner=i=>new THREE.Vector3().fromBufferAttribute(positions,i%count);
      const outer=i=>new THREE.Vector3().fromBufferAttribute(positions,count+(i%count));
      for(const roller of b.rollers){
        const center=roller.getWorldPosition(new THREE.Vector3()).applyMatrix4(model.root.matrixWorld.clone().invert());let minimumGap=Infinity;
        for(let i=0;i<count;i++){
          const a=inner(i),c=inner(i+1),dx=c.x-a.x,dy=c.y-a.y,t=Math.max(0,Math.min(1,((center.x-a.x)*dx+(center.y-a.y)*dy)/(dx*dx+dy*dy)));
          const gap=Math.hypot(a.x+t*dx-center.x,a.y+t*dy-center.y)-g.rollerRadius;
          assert.ok(gap>-0.006,`rubber enters roller by ${-gap}`);minimumGap=Math.min(minimumGap,gap);
        }
        // away from the necks, where the rubber dips into its clamp
        if(Math.abs(Math.sin(Math.atan2(center.y,center.x)))>Math.sin(10*Math.PI/180))maximumContactGap=Math.max(maximumContactGap,minimumGap);
      }
      for(let i=0;i<count;i++){
        const p=outer(i),r=Math.hypot(p.x,p.y),a=Math.atan2(p.y,p.x);
        const nearNeck=Math.min(Math.abs(Math.sin(a)))<Math.sin(g.vRimAngle+0.02)&&Math.abs(Math.cos(a))>0.9;
        if(!nearNeck)assert.ok(r<=g.boreRadius+1e-6,'rubber inside the bore');
      }
    }
    // every roller keeps the rubber pinched on the bore
    assert.ok(maximumContactGap<0.01,`rubber contact gap ${maximumContactGap}`);
  }finally{disposeObject3D(model.root);}
});
