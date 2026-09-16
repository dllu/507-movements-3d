import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredEccentricShaftRadialPistonEngineMovement} from '../src/simulation/authored-eccentric-shaft-radial-piston-engines.js';
import {createAuthoredRubberLinedRotaryEngineMovement} from '../src/simulation/authored-rubber-lined-rotary-engines.js';
import {createAuthoredDoubleEllipticalRotaryEngineMovement} from '../src/simulation/authored-double-elliptical-rotary-engines.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
function clearCycle(model,pairs) {
  let maximumResidual=0;
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
        if(surface.inside(p)){const depth=surface.distance(p);if(from.userData.role.includes("exact-official")&&to.userData.role.includes("exact-official")){maximumResidual=Math.max(maximumResidual,depth);continue;}assert.ok(depth<3e-7,
          `${from.userData.role} enters ${to.userData.role}: frame ${frame}, depth ${depth}`);}
      }
    }
  }
  assert.ok(maximumResidual<0.0135, `retained official 429 profile residual worsened: ${maximumResidual}`);
  return maximumResidual;
}

const factories=[[427,createAuthoredEccentricShaftRadialPistonEngineMovement],[428,createAuthoredRubberLinedRotaryEngineMovement],[429,createAuthoredDoubleEllipticalRotaryEngineMovement]];
for(const[id,create]of factories)test(`${id}: finite working walls and joints clear; retained 429 mating residual stays bounded`,()=>{
  const model=create({id}),u=model.root.userData,b=u.blocks;try{
    const pairs=[];
    if(id===427){
      for(const moving of[b.hubC,b.leftPackingBody,b.rightPackingBody,b.leftPistonBody,b.rightPistonBody,b.leftPistonSeal,b.rightPistonSeal])pairs.push([moving,b.cylinderA]);
      for(const moving of[b.leftPackingBody,b.rightPackingBody,b.leftPistonBody,b.rightPistonBody,b.leftPistonSeal,b.rightPistonSeal])pairs.push([moving,b.hubC]);
      for(const side of['left','right']){
        for(const moving of[b[side+'PistonBody'],b[side+'PistonSeal'],b[side+'GuidePin']])pairs.push([moving,b[side+'PackingBody']]);
        for(const ring of[b.guideRingInner,b.guideRingOuter])pairs.push([b[side+'GuidePin'],ring],[b[side+'PistonBody'],ring]);
        assert.ok(!solidSurface(b[side+'PackingBody'].geometry).inside(new THREE.Vector3(0,0,.5)),'packing has a real blade slot');
        assert.ok(solidSurface(b[side+'PackingBody'].geometry).inside(new THREE.Vector3(0,0,.18)),'rear packing web joins the two sides');
      }
    }else if(id===428){
      for(let i=0;i<3;i++)pairs.push([b.rollersA[i],b.rollerArms[i]],[b.rollersA[i],b.rollerPins[i]],[b.rollersA[i],b.rearHousing]);
      assert.ok(!solidSurface(b.rollersA[0].geometry).inside(new THREE.Vector3(0,0,0)),'roller axle is genuinely bored');
    }else{
      pairs.push([b.leftPiston,b.rightPiston]);
      for(const moving of[b.leftPiston,b.rightPiston,...b.leftPackingStrips,...b.rightPackingStrips])pairs.push([moving,b.rearHousing]);
      for(const strip of b.leftPackingStrips)pairs.push([strip,b.rightPiston]);
      for(const strip of b.rightPackingStrips)pairs.push([strip,b.leftPiston]);
    }
    assert.equal(u.hideGround,true);model.root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])assert.equal(material.fog,false);});
    clearCycle(model,pairs);
  }finally{disposeObject3D(model.root);}
});


test('428: rendered finite liner remains outside each roller and within contact tessellation tolerance',()=>{
  const model=createAuthoredRubberLinedRotaryEngineMovement({id:428});
  try{
    const b=model.root.userData.blocks;let maximumContactGap=0;
    for(let frame=0;frame<=64;frame++){
      model.update(frame*4/64);model.root.updateMatrixWorld(true);
      const positions=b.linerE.geometry.attributes.position,count=positions.count/4;
      for(const roller of b.rollersA){
        const center=roller.getWorldPosition(new THREE.Vector3());let minimumGap=Infinity;
        for(let i=0;i<count;i++){
          const a=new THREE.Vector3().fromBufferAttribute(positions,i*4).applyMatrix4(b.linerE.matrixWorld);
          const c=new THREE.Vector3().fromBufferAttribute(positions,((i+1)%count)*4).applyMatrix4(b.linerE.matrixWorld);
          const dx=c.x-a.x,dy=c.y-a.y,t=Math.max(0,Math.min(1,((center.x-a.x)*dx+(center.y-a.y)*dy)/(dx*dx+dy*dy)));
          const gap=Math.hypot(a.x+t*dx-center.x,a.y+t*dy-center.y)-.5;
          assert.ok(gap>-2e-7,`liner penetrates circular roller by ${-gap}`);minimumGap=Math.min(minimumGap,gap);
        }
        maximumContactGap=Math.max(maximumContactGap,minimumGap);
      }
    }
    // The 256-sided roller adds at most 0.000038 of radial chord error.
    assert.ok(maximumContactGap<0.00012,`liner mesh contact gap ${maximumContactGap}`);
  }finally{disposeObject3D(model.root);}
});
