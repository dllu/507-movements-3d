import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredSquarePistonEngineMovement} from '../src/simulation/authored-square-piston-engines.js';
import {createAuthoredEccentricRotaryEngineMovement} from '../src/simulation/authored-eccentric-rotary-engines.js';
import {createAuthoredRadialPistonRotaryEngineMovement} from '../src/simulation/authored-radial-piston-rotary-engines.js';
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
const factories=[[424,createAuthoredSquarePistonEngineMovement],[425,createAuthoredEccentricRotaryEngineMovement],[426,createAuthoredRadialPistonRotaryEngineMovement]];
for(const[id,create]of factories)test(`${id}: actual working piston, chamber and guide solids clear through one revolution`,()=>{
  const model=create({id}),u=model.root.userData,b=u.blocks;try{
    const pairs=[];
    if(id===424){
      for(const fixed of [b.mainShaftB,b.crankArm,b.crankWristA])for(const piston of [b.pistonCBody,b.pistonCWristBearing])pairs.push([fixed,piston]);
      for(const wall of b.pistonB.children)for(const piston of[b.pistonCBody])pairs.push([wall,piston]);
      for(const wall of b.cylinderA.children)for(const piston of b.pistonB.children)pairs.push([wall,piston]);
      assert.ok(!solidSurface(b.pistonCBody.geometry).inside(new THREE.Vector3(0,0,0)),'C wrist is truly bored');
      assert.ok(!solidSurface(b.pistonCWristBearing.geometry).inside(new THREE.Vector3(0,0,0)),'wrist bearing is annular');
    }else if(id===425){
      for(const fixed of [b.housingBack,b.innerCylinderWall,b.outerCylinderWall,b.neckLeft,b.neckRight,...b.guideTower.children])
        for(const moving of[b.eccentricPiston,b.sealShoe,b.abutmentNose,b.abutmentStem])pairs.push([fixed,moving]);
      for(const moving of[b.abutmentNose,b.abutmentStem])pairs.push([moving,b.eccentricPiston],[moving,b.sealShoe]);
    }else{
      const fixed=[b.topHousingBack,b.bottomHousingBack,b.leftAbutmentBody,b.rightAbutmentBody,b.leftAbutmentNose,b.rightAbutmentNose,b.upperInnerWall,b.lowerInnerWall];
      for(const wall of fixed)for(const moving of[b.hubC,b.positivePistonBody,b.negativePistonBody,b.positivePistonNose,b.negativePistonNose])pairs.push([wall,moving]);
      for(const moving of[b.positivePistonBody,b.negativePistonBody,b.positivePistonNose,b.negativePistonNose])for(const guide of[b.hubC,b.groove,b.shaftB])pairs.push([moving,guide]);
      const hub=solidSurface(b.hubC.geometry);
      assert.ok(!hub.inside(new THREE.Vector3(1,0,.3)),'radial groove is cut into the hub');
      assert.ok(hub.inside(new THREE.Vector3(1,0,0)),'rear hub web remains behind the groove');
    }
    assert.equal(u.hideGround,true);model.root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])assert.equal(material.fog,false);});
    clearCycle(model,pairs);
  }finally{disposeObject3D(model.root);}
});

test('425/426: corrected finite working surfaces retain near contact across the entire cycle',()=>{
  for(const[id,create]of factories.slice(1)){
    const model=create({id}),u=model.root.userData,b=u.blocks;
    try{
      if(id===425){
        const piston=solidSurface(b.eccentricPiston.geometry),nose=solidSurface(b.abutmentNose.geometry),wall=solidSurface(b.housingBack.geometry);
        for(let frame=0;frame<=64;frame++){
          const time=frame*u.geometry.cycleDuration/64;model.update(time);model.root.updateMatrixWorld(true);
          const state=u.stateAtTime(time),point=state.pistonAbutmentContactPoint.clone();point.z=.3;
          const gap=piston.distance(point.clone().applyMatrix4(b.eccentricPiston.matrixWorld.clone().invert()))
            +nose.distance(point.clone().applyMatrix4(b.abutmentNose.matrixWorld.clone().invert()));
          assert.ok(gap<.000044,'source circular-cap and piston contact survives finite meshing');
          assert.ok(state.contactNormal.y>.94,'contact reaction lifts the abutment');
          const contact=state.pistonCylinderContactPoint.clone();contact.z=.3;
          const fromTop=Math.abs(Math.atan2(contact.x,contact.y)),[portNear,portFar]=u.solidReview.portWindowAnglesFromTop;
          if(fromTop>.072&&!(fromTop>portNear-.01&&fromTop<portFar+.01))assert.ok(wall.distance(contact)<.000032,'piston reaches the working chamber outside the abutment opening and the two port windows');
        }
      }else{
        const surfaces=[b.topHousingBack,b.bottomHousingBack,b.leftAbutmentBody,b.rightAbutmentBody].map(mesh=>solidSurface(mesh.geometry));
        for(let frame=0;frame<=64;frame++){
          model.update(frame*u.geometry.cycleDuration/64);model.root.updateMatrixWorld(true);
          for(const nose of[b.positivePistonNose,b.negativePistonNose]){
            const at=angle=>{
              const p=new THREE.Vector3(u.geometry.followerNoseRadius*Math.cos(angle),u.geometry.followerNoseRadius*Math.sin(angle),.46).applyMatrix4(nose.matrixWorld);
              return Math.min(...surfaces.map(surface=>surface.distance(p)));
            };
            let best=0,gap=Infinity;
            for(let i=0;i<=128;i++){const angle=-Math.PI/6+i*Math.PI/384,distance=at(angle);if(distance<gap){gap=distance;best=angle;}}
            // Refine only the best local bracket; avoids mistaking angular
            // sample spacing for a real opening between the finite surfaces.
            let low=Math.max(-Math.PI/6,best-Math.PI/384),high=Math.min(Math.PI/6,best+Math.PI/384);
            for(let i=0;i<24;i++){const a=low+(high-low)/3,c=high-(high-low)/3;if(at(a)<at(c))high=c;else low=a;}
            gap=Math.min(gap,at((low+high)/2));
            assert.ok(gap>.00002&&gap<.000060,'both source nose caps remain next to the actual fixed working profile');
          }
        }
      }
    }finally{disposeObject3D(model.root);}
  }
});
