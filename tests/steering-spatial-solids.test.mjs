import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredRopeSteeringMovement} from '../src/simulation/authored-rope-steering.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';

function workingTargets(b) {
  return [b.barrel,...b.barrelFlanges,b.fixedShaft,...b.wheelPedestals,
    ...b.shaftBearings,b.upperGuide.sheave,b.upperGuide.groove,b.upperGuide.pin,
    b.upperGuide.post,b.lowerGuide.sheave,b.lowerGuide.groove,b.lowerGuide.pin,
    b.lowerGuide.post,b.tillerBar,b.tillerTipBoss,b.handwheelRim,...b.handwheelSpokes];
}

test('490 actual rope triangles clear barrel, flanges, guide grooves, axles and supports through steering',()=>{
  const model=createAuthoredRopeSteeringMovement({id:490});
  const {blocks:b,geometry:g}=model.root.userData;
  const targets=workingTargets(b).map(mesh=>({mesh,surface:solidSurface(mesh.geometry)}));
  let nearSurfaceQueries=0;
  for(let i=0;i<=32;i++) {
    model.update(g.cycleDuration*i/32);
    model.root.updateMatrixWorld(true);
    const points=surfacePoints(b.rope.geometry);
    for(const {mesh,surface} of targets) {
      const transform=mesh.matrixWorld.clone().invert().multiply(b.rope.matrixWorld);
      for(const point of points) {
        const local=point.clone().applyMatrix4(transform);
        if(surface.box.distanceToPoint(local)>.005)continue;
        nearSurfaceQueries++;
        const gap=surface.signedDistance(local,.01);
        assert.ok(gap>=-1e-6,
          `${mesh.userData.role}: rope penetration ${gap} at phase ${i/32}, local ${local.toArray()}`);
      }
    }
  }
  assert.ok(nearSurfaceQueries>1000,'the sweep must examine actual near-contact rope surfaces');
  // The short rope ends deliberately enter the separate fastening clamps;
  // the boss below them and all other working metal above are clearance pairs.
});

test('490 nonneighbor pieces of the rendered rope remain spatially disjoint',()=>{
  const model=createAuthoredRopeSteeringMovement({id:490});
  const {blocks:b,geometry:g}=model.root.userData;
  for(let pose=0;pose<=32;pose++) {
    model.update(g.cycleDuration*pose/32);
    const geometry=b.rope.geometry,positions=geometry.attributes.position;
    const sides=geometry.parameters.radialSegments;
    const stride=sides+1,segments=geometry.parameters.tubularSegments;
    const boxes=[];
    // Each actual tube cell consists entirely of triangles whose vertices
    // lie on these two rings. Disjoint boxes prove disjoint finite surfaces;
    // this uses the visible mesh, not the nominal helix pitch or curve law.
    for(let i=0;i<segments;i++) {
      const points=[];
      for(const ring of [i,i+1])for(let j=0;j<sides;j++)
        points.push(new THREE.Vector3().fromBufferAttribute(positions,ring*stride+j));
      boxes.push(new THREE.Box3().setFromPoints(points));
    }
    // The two immediate neighboring cells share the continuous local bend;
    // the audit concerns distinct rope reaches and successive barrel turns.
    for(let i=0;i<segments;i++)for(let j=i+3;j<segments;j++)
      assert.equal(boxes[i].intersectsBox(boxes[j]),false,
        `nonneighbor rope cells ${i}/${j} require a narrow-phase check at pose ${pose}/32`);
  }
});
