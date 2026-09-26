import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredRopeSteeringMovement} from '../src/simulation/authored-rope-steering.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';

function workingTargets(b) {
  return [b.barrel,...b.barrelFlanges,b.fixedShaft,
    ...b.shaftBearings,b.upperGuide.sheave,b.upperGuide.groove,b.upperGuide.pin,
    b.upperGuide.bracket,b.lowerGuide.sheave,b.lowerGuide.groove,b.lowerGuide.pin,
    b.lowerGuide.bracket,b.tillerBar,b.tillerTipBoss,b.handwheelRim,...b.handwheelSpokes];
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
    assert.equal(geometry.type,'LaidRopeGeometry');
    const around=geometry.parameters.radialSegments,segments=geometry.parameters.tubularSegments;
    const strands=geometry.userData.ropeLay.strands,perStrand=(segments+1)*around+2;
    const cellLength=geometry.userData.ropeLay.length/segments;
    // Cells within two rope diameters of arc share the local bend.
    const neighbor=Math.ceil(4*g.ropeRadius/cellLength)+1;
    const boxes=[];
    // Every triangle of the three laid strands in a cell has its vertices on
    // these two cross-sections. Disjoint boxes prove disjoint finite surfaces;
    // this uses the visible mesh, not the nominal helix pitch or curve law.
    for(let i=0;i<segments;i++) {
      const box=new THREE.Box3(),point=new THREE.Vector3();
      for(let k=0;k<strands;k++)for(const ring of [i,i+1])for(let j=0;j<around;j++)
        box.expandByPoint(point.fromBufferAttribute(positions,k*perStrand+ring*around+j));
      boxes.push(box);
    }
    // The audit concerns distinct rope reaches and successive barrel turns.
    // Boxes that meet get a narrow-phase check on the rope centreline: the
    // two centreline chords must stay a full rope diameter apart.
    const centers=geometry._laid.centers,chord=new THREE.Line3(),other=new THREE.Line3(),p=new THREE.Vector3(),q=new THREE.Vector3();
    const chordDistance=(i,j)=>{chord.set(centers[i],centers[i+1]);other.set(centers[j],centers[j+1]);let d=Infinity;
      for(let t=0;t<=8;t++){chord.at(t/8,p);other.closestPointToPoint(p,true,q);d=Math.min(d,p.distanceTo(q));}return d;};
    for(let i=0;i<segments;i++)for(let j=i+neighbor;j<segments;j++)
      if(boxes[i].intersectsBox(boxes[j])&&chordDistance(i,j)<2*g.ropeRadius)assert.fail(
        `nonneighbor rope cells ${i}/${j} overlap at pose ${pose}/32`);
  }
});
