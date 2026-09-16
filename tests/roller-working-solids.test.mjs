import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredSkewRollerFeedMovement} from '../src/simulation/authored-skew-roller-feeds.js';
import {createAuthoredRollingFrictionExperimentMovement} from '../src/simulation/authored-rolling-friction-experiments.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from './helpers/solid-surface.mjs';
const create = id => (id === 365 ? createAuthoredSkewRollerFeedMovement : createAuthoredRollingFrictionExperimentMovement)({id});

for (const id of [365,373]) test(`${id} selected finite rolling interfaces clear through playback and meet their nominal contacts`, () => {
  const model=create(id), {blocks:b,geometry:g}=model.root.userData, cache=new Map();
  const get=o=>{if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),surface:solidSurface(o.geometry)});return cache.get(o);};
  try {
    const pairs=[];
    if(id===365) pairs.push(...b.rollerBodies.map(o=>[o,b.rodBody]),[...b.rollerBodies]);
    else {
      const drum=b.largeWheel.userData.workingParts;
      const fixed=[b.base,b.largeAxle,...b.supportBeams,b.chassis,b.wagonBed,...b.axleHangers];
      for(const moving of [drum.rim,drum.hub,...drum.spokes,b.workingPulley]) for(const other of fixed) pairs.push([moving,other]);
      for(const [i,wheel]of b.carriageWheels.entries())for(const moving of [wheel.userData.workingParts.rim,wheel.userData.workingParts.hub]) {
        for(const other of [drum.rim,b.chassis,b.wagonBed,...b.axleHangers,b.carriageAxlePins[i],b.tetherBracket]) pairs.push([moving,other]);
      }
      for(const load of b.fixedLoads)pairs.push([load,b.testWeight]);
      pairs.push([b.testWeight,b.wagonBed],[b.workingPulley,b.beltWrap],[b.workingPulley,b.upperBeltStrand],[b.workingPulley,b.lowerBeltStrand],
        [b.tether,b.dialFace],[b.tether,b.indicatorHousing],[b.pointerPin,b.dialFace]);
    }
    let worst=0,where='';
    for(let i=0;i<=24;i++) {
      model.update(model.root.userData.minimumDisplayCycleSeconds*i/24);model.root.updateMatrixWorld(true);
      for(const pair of pairs) for(const[a,c]of[pair,[...pair].reverse()]) {
        const transform=c.matrixWorld.clone().invert().multiply(a.matrixWorld),target=get(c).surface;
        for(const point of get(a).points) {
          const p=point.clone().applyMatrix4(transform);
          if(target.box.distanceToPoint(p)>1e-6)continue;
          const gap=target.signedDistance(p,.06);
          if(gap<worst){worst=gap;where=`pose ${i}: ${a.userData.role} / ${c.userData.role}`;}
        }
      }
      const contacts=id===365?[[g.frontContactPoint,b.rollerBodies[0],b.rodBody],[g.rearContactPoint,b.rollerBodies[1],b.rodBody]]:
        model.root.userData.contactPoints.map((p,j)=>[p,b.largeWheel.userData.workingParts.rim,b.carriageWheels[j].userData.workingParts.rim]);
      for(const [p,...parts] of contacts)for(const part of parts) {
        const local=p.clone().applyMatrix4(model.root.matrixWorld).applyMatrix4(part.matrixWorld.clone().invert());
        assert.ok(Math.abs(get(part).surface.signedDistance(local,.003))<.0002,`${id} actual rolling surface misses contact`);
      }
    }
    assert.ok(worst>-2e-6,`${where}: ${worst}`);
  } finally {disposeObject3D(model.root);}
});

test('365 material markers are surface paint and disappear continuously at each wrap',()=>{
  const model=create(365),{blocks:b,geometry:g}=model.root.userData;
  try {
    for(const marker of [...b.rodMarkers,...b.rollerTreadIndexes]) {
      assert.equal(marker.userData.surfacePaint,true);
      const p=marker.geometry.attributes.position, radius=b.rodMarkers.includes(marker)?g.rodRadius:g.rollerRadius;
      for(let i=0;i<p.count;i++)assert.ok(Math.abs(Math.hypot(p.getX(i),p.getZ(i))-radius)<.000051);
    }
    const marker=b.rodMarkers[0], t=(g.upperMarkerWrapY-marker.userData.baseCoordinate)/g.rodAxialVelocity;
    for(const dt of [-1e-7,0,1e-7]) {model.update(t+dt);assert.ok(marker.scale.y<1e-6);}
    assert.equal(b.frame.visible,false);
  } finally {disposeObject3D(model.root);}
});

test('373 source spokes connect hub to rim and the calibrated instrument is explicitly qualified',()=>{
  const model=create(373),{blocks:b,workingRollerReview:review}=model.root.userData;
  try {
    const {spokes,hub,rim}=b.largeWheel.userData.workingParts;
    assert.equal(spokes.length,4);
    model.root.updateMatrixWorld(true);
    for(const spoke of spokes) {
      const box=new THREE.Box3().setFromObject(spoke);
      assert.ok(box.intersectsBox(new THREE.Box3().setFromObject(hub)));
      const end=new THREE.Vector3(spoke.geometry.parameters.width/2,0,0).applyMatrix4(spoke.matrixWorld).applyMatrix4(rim.matrixWorld.clone().invert());
      assert.ok(solidSurface(rim.geometry).inside(end));
    }
    for(const wheel of [b.largeWheel,...b.carriageWheels])assert.equal(solidSurface(wheel.userData.workingParts.hub.geometry).inside(new THREE.Vector3()),false);
    assert.equal(b.spiralSpring.visible,false);
    assert.match(review.residual,/internal tether-to-spring transmission/);
  } finally {disposeObject3D(model.root);}
});
