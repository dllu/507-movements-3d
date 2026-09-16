import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredBearingMovement} from '../src/simulation/authored-bearings.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from './helpers/solid-surface.mjs';

for (const id of [250,270]) {
  test(`${id} actual working bearing surfaces clear moving and fixed neighbors`, () => {
    const model = createAuthoredBearingMovement({id}), {blocks:b,geometry:g} = model.root.userData;
    try {
      const pairs = [];
      if (id === 250) {
        const left=[b.leftSupportHub,b.leftSupportRim,...b.leftSupportSpokes];
        const right=[b.rightSupportHub,b.rightSupportRim,...b.rightSupportSpokes];
        const main=[b.mainFlywheelHub,b.mainFlywheelRim,...b.mainFlywheelSpokes,b.shaftJournal];
        for (const moving of [...left,...right,...main]) for (const fixed of [b.frame,b.base,...b.supportAxles,...b.pivotCaps]) pairs.push([moving,fixed]);
        for (const l of left) for (const r of right) pairs.push([l,r]);
        for (const m of main) for (const support of [...left,...right]) pairs.push([m,support]);
      } else {
        for (const [i,a] of b.rollerAssemblies.entries()) {
          for (const mesh of [a.body,a.hub]) for (const fixed of [b.innerRace,b.cagePlate,b.pulleyWeb,b.pulleyRim,b.cagePins[i]]) pairs.push([mesh,fixed]);
          for(const other of b.rollerAssemblies.slice(i+1)) pairs.push([a.body,other.body]);
        }
        pairs.push([b.innerRace,b.cagePlate],[b.belt,b.pulleyRim],[b.cagePlate,b.pulleyWeb]);
      }
      const cache=new Map();
      const get=o=>{if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),surface:solidSurface(o.geometry)});return cache.get(o);};
      let worst=0,where='';
      const period=id===250?g.fullMarkedAssemblyClosure:model.root.userData.timeline.fullMarkedAssemblyClosure;
      for(let i=0;i<=24;i++) {
        model.update(period*(i+.173)/25);model.root.updateMatrixWorld(true);
        for(const pair of pairs)for(const[moving,fixed]of[pair,[...pair].reverse()]) {
          const transform=fixed.matrixWorld.clone().invert().multiply(moving.matrixWorld),target=get(fixed).surface;
          for(const point of get(moving).points) {
            const p=point.clone().applyMatrix4(transform);
            if(target.box.distanceToPoint(p)>1e-6)continue;
            const gap=target.signedDistance(p,.05);
            if(gap<worst){worst=gap;where=`pose${i}: ${moving.userData.role} / ${fixed.userData.role}`;}
          }
        }
      }
      assert.ok(worst>-2e-6,`${where}: ${worst}`);
    } finally {disposeObject3D(model.root);}
  });

  test(`${id} actual bores are open and geometry remains stable through playback`,()=>{
    const model=createAuthoredBearingMovement({id}),{blocks:b}=model.root.userData;
    try{
      for(const mesh of id===250?[b.leftSupportHub,b.rightSupportHub]:b.rollerBodies) {
        const solid=solidSurface(mesh.geometry);
        assert.equal(solid.inside(new THREE.Vector3()),false);
        assert.equal(solid.inside(new THREE.Vector3(.25,0,0)),true);
      }
      const snapshot=()=>{const result=[];model.root.traverse(o=>result.push([o,o.geometry]));return result;};
      const before=snapshot();for(let i=0;i<100;i++)model.update(i*.371);
      assert.deepEqual(snapshot(),before);
      assert.equal(model.root.userData.hideGround,true);
      assert.ok(model.root.userData.minimumDisplayCycleSeconds>=6);
      if(id===250) {
        for(const spokes of [b.leftSupportSpokes,b.rightSupportSpokes]) {
          assert.equal(spokes.length,4,'four diagonal spokes, not eight boundary lines interpreted as spokes');
          assert.ok(Math.abs(spokes[0].rotation.z-Math.PI/4)<1e-12);
        }
        assert.ok(b.base.position.y<-12.7,'pedestal extends well below support wheels');
        assert.ok(b.frame.position.z>b.rightSupportRim.position.z+.5,'pedestal is in front of both wheels');
      } else assert.equal(b.supportPost.parent,null,'no unsupported invented stand');
    }finally{disposeObject3D(model.root);}
  });
}

test('working surfaces meet the analytical rolling contacts rather than merely clearing them',()=>{
  for(const id of [250,270]) {
    const model=createAuthoredBearingMovement({id}),{blocks:b,geometry:g}=model.root.userData;
    try {
      for(let i=0;i<17;i++) {
        model.update(i*.317);model.root.updateMatrixWorld(true);
        const s=model.root.userData.kinematics;
        const contactPairs=id===250?
          [[s.leftRollingContact.contact3D,b.leftSupportRim,b.shaftJournal],[s.rightRollingContact.contact3D,b.rightSupportRim,b.shaftJournal]]:
          s.rollers.flatMap((r,index)=>[
            [new THREE.Vector3(r.innerContactPoint.x,r.innerContactPoint.y,0),b.innerRace,b.rollerBodies[index]],
            [new THREE.Vector3(r.outerContactPoint.x,r.outerContactPoint.y,0),b.pulleyWeb,b.rollerBodies[index]],
          ]);
        for(const [point,...meshes] of contactPairs) {
          const world=point.clone().applyMatrix4(model.root.matrixWorld);
          for(const mesh of meshes) {
            const local=world.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
            const gap=solidSurface(mesh.geometry).signedDistance(local,.003);
            assert.ok(Math.abs(gap)<.001,`${id} ${mesh.userData.role}: ${gap}`);
          }
        }
      }
    }finally{disposeObject3D(model.root);}
  }
});
