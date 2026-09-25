import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createAuthoredRedirectedWindlassMovement as windlass} from '../src/simulation/authored-redirected-windlasses.js';
import {createAuthoredFuseeTraverseMovement as fusee} from '../src/simulation/authored-fusee-traverses.js';
import {createAuthoredGroovedCylinderTraverseMovement as cylinder} from '../src/simulation/authored-grooved-cylinder-traverses.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const models=new Map([[352,windlass({id:352})],[358,fusee({id:358})],[362,cylinder({id:362})]]);
const meshes=o=>{const result=[];o.traverseVisible(c=>{if(c.isMesh)result.push(c);});return result;};
function checkPairs(model,pairs,dynamic=[],steps=16){
 const cache=new Map(),get=o=>{if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),solid:solidSurface(o.geometry)});return cache.get(o);};
 const d=model.root.userData,period=d.geometry.cyclePeriod??d.geometry.inputCyclePeriod;
 for(let i=0;i<=steps;i++){
  model.update(period*i/steps);model.root.updateMatrixWorld(true);
  // Both vertices and BVHs must be refreshed for retained, deforming rope buffers.
  for(const o of dynamic)cache.delete(o);
  for(const pair of pairs)for(const [moving,fixed]of[pair,[...pair].reverse()]){
   const transform=fixed.matrixWorld.clone().invert().multiply(moving.matrixWorld),solid=get(fixed).solid;
   for(const point of get(moving).points){const q=point.clone().applyMatrix4(transform);if(solid.box.distanceToPoint(q)>1e-6)continue;
    assert.ok(solid.signedDistance(q,.04)>=-2e-6,`${d.movementId??''} pose ${i}: ${moving.userData.role} intersects ${fixed.userData.role} at ${q.toArray()}`);
   }
  }
 }
}
test('352 finite rope clears both plain barrels, three working grooves and hanger',()=>{
 const m=models.get(352),b=m.root.userData.blocks;
 checkPairs(m,[b.largeBarrel,b.smallBarrel,...b.barrelFlanges,b.leftGuide.pulley.userData.workingGroove,b.rightGuide.pulley.userData.workingGroove,b.movingPulley.userData.workingGroove,b.hanger].map(o=>[b.ropeMesh,o]),[b.ropeMesh]);
});
test('358 both finite cords clear the cut fusee and one another across the full traverse',()=>{
 const m=models.get(358),b=m.root.userData.blocks,a=b.firstCord.userData.mesh,c=b.secondCord.userData.mesh;
 checkPairs(m,[[a,b.fuseeBody],[c,b.fuseeBody],[a,c]],[a,c]);
});
test('362 actual rounded follower and stem clear groove floors/flanks and end plates, and shafts pass journals',()=>{
 const m=models.get(362),b=m.root.userData.blocks,pairs=[];
 for(const o of[b.followerTip,...meshes(b.followerStem)])for(const f of[b.groovedCylinder,...b.cylinderEndRims])pairs.push([o,f]);
 for(const o of b.upperBearings)pairs.push([b.upperShaft,o],[b.upperDrum,o]);
 for(const o of b.lowerBearings)pairs.push([b.lowerShaft,o]);
 checkPairs(m,pairs,[],32);
});
test('362 groove retains finite material and captures the pin on both axial flanks',()=>{
 const m=models.get(362),b=m.root.userData.blocks,g=m.root.userData.geometry,solid=solidSurface(b.groovedCylinder.geometry),points=surfacePoints(b.followerTip.geometry);
 assert.ok(solid.inside(new T.Vector3(0,.5,0)),'barrel wall is solid');
 assert.ok(!solid.inside(new T.Vector3(0,.05,0)),'shaft bore is open');
 for(const time of[0,1,2,3,4,5,6,7]){
  m.update(time);m.root.updateMatrixWorld(true);
  const transform=b.groovedCylinder.matrixWorld.clone().invert().multiply(b.followerTip.matrixWorld);
  for(const sign of[-1,1])assert.ok(points.some(p=>solid.inside(p.clone().applyMatrix4(transform).add(new T.Vector3(sign*.055,0,0)))),'axially displaced pin must encounter a retaining flank');
  assert.ok(Math.abs(m.root.userData.currentState.outputVelocityX)<=g.peakTraverseSpeed+1e-10);
 }
});
// A tube contains its centreline; a three-strand laid rope does not (the
// strands leave a small core gap), so it must contain its first strand's axis.
function cordCore(cord){
 const geometry=cord.userData.mesh.geometry;
 if(geometry.type!=='LaidRopeGeometry')return cord.userData.curve.getPointAt(.413);
 const {centers,frames,along,length,dims}=geometry._laid,i=Math.round(.413*along),phase=2*Math.PI*(length*i/along-geometry.userData.travel)/dims.lay;
 return centers[i].clone().addScaledVector(frames.normals[i],dims.layRadius*Math.cos(phase)).addScaledVector(frames.binormals[i],dims.layRadius*Math.sin(phase));
}
test('352 and 358 deform closed cords without replacing geometry or growing scenes',()=>{
 for(const id of[352,358]){
  const m=models.get(id),b=m.root.userData.blocks,cords=id===352?[b.rope]:[b.firstCord,b.secondCord],geometry=cords.map(c=>c.userData.mesh.geometry),count=meshes(m.root).length;
  for(let i=0;i<=12;i++){m.update(i);assert.equal(meshes(m.root).length,count);cords.forEach((c,j)=>{assert.equal(c.userData.mesh.geometry,geometry[j]);assert.ok(solidSurface(c.userData.mesh.geometry).inside(cordCore(c)),'closed cord contains its centerline (a laid rope: its first strand axis)');});}
 }
});
test('358 follows the ten-turn carriage law while retaining the complete track and travel marks',()=>{
 const m=models.get(358),d=m.root.userData,b=d.blocks;
 assert.equal(d.geometry.revolutionCount,10);assert.equal(d.cameraMaxDistance,10*d.geometry.anchorHalfSpan);
 assert.ok(b.track.children.filter(o=>o.userData.role==='rail-travel-reference-mark').length>=20);
 for(let i=0;i<=24;i++){m.update(i/2);m.root.updateMatrixWorld(true);assert.ok(Math.abs(b.carriage.getWorldPosition(new T.Vector3()).y)<1e-12);assert.ok(Math.abs(b.carriage.position.x-d.currentState.carriagePosition)<1e-12);}
 const size=d.cameraFitBounds.getSize(new T.Vector3());assert.ok(size.y<6&&size.y<d.geometry.trackHalfLength,'carriage closeup excludes remote track ends');
 // The fixed cord eyes never swing into the carriage-following closeup.
 for(let i=0;i<=64;i++){m.update(d.geometry.cyclePeriod*i/64);for(const x of[-d.geometry.anchorHalfSpan,d.geometry.anchorHalfSpan])assert.ok(Math.abs(x-d.currentState.carriagePosition)>1.4*size.y,'cord eye stays outside the closeup');}
});
test('352 adjacent finite rope turns stay separated through the changing wound packs',()=>{
 const m=models.get(352),d=m.root.userData;
 for(let i=0;i<=32;i++){
  m.update(d.geometry.cyclePeriod*i/32);
  const curves=d.blocks.rope.userData.curve.curves;
  for(const helix of[curves[0],curves.at(-1)]){
   const turn=2*Math.PI/helix.wrapSweep;
   for(let j=0;j<=100;j++)for(let k=-8;k<=8;k++){
    const a=j/100,step=turn*(1+k*.005),b=a+step;if(b>1)continue;
    assert.ok(helix.getPoint(a).distanceTo(helix.getPoint(b))>2*d.geometry.ropeRadius,'adjacent rendered-radius coils must clear');
   }
  }
 }
});
test('358 carriage wheels rest above rails and their axles pass actual hub bores',()=>{
 const m=models.get(358),b=m.root.userData.blocks,axles=b.carriage.children.filter(o=>o.userData.role==='fixed-carriage-wheel-axle');
 const rail=b.track.children.find(o=>o.userData.role==='fixed-carriage-guide-rail'),railTop=rail.position.z+rail.geometry.parameters.depth/2;
 const pairs=b.carriageWheels.map(w=>[w.userData.hub,axles.find(a=>a.position.x===w.position.x)]);
 // Brown's plan: gravity runs into the page, so each wheel sits on the rail beneath it.
 for(const w of b.carriageWheels){assert.ok(Math.abs(w.position.z-m.root.userData.geometry.wheelRadius-railTop)<1e-12,'wheel bottom meets rail top');assert.equal(w.position.y,rail.position.y);}
 checkPairs(m,pairs,[],4);
});
test('all three models have readable cycle minimums, no fog or ground, and explicit mechanics residuals',()=>{
 for(const m of models.values()){const d=m.root.userData;assert.ok(d.minimumDisplayCycleSeconds>=8);assert.equal(d.hideGround,true);assert.match(d.workingPartsReview.residual,/approximation|not simulated/);m.root.traverse(o=>{for(const material of[].concat(o.material??[]))assert.equal(material.fog,false);});}
});

test('362 all three rear standards bear on the finite bed plate',()=>{
 const m=models.get(362),b=m.root.userData.blocks;m.update(0);m.root.updateMatrixWorld(true);
 const base=b.frame.children.find(o=>o.userData.role==='source-visible-bed-plate'),bed=new T.Box3().setFromObject(base);
 for(const journal of[...b.upperBearings,...b.lowerBearings]){
  const bridge=b.frame.children.find(o=>o.userData.role==='journal-bridge-to-rear-post'&&o.position.x===journal.position.x&&o.position.y===journal.position.y),post=b.framePosts.find(o=>o.position.x===journal.position.x);
  for(const [object,z]of[[journal,-.17],[post,-.30]]){
   const q=new T.Vector3(journal.position.x,journal.position.y,z);assert.ok(new T.Box3().setFromObject(bridge).containsPoint(q),'bridge reaches the intended join');
   assert.ok(solidSurface(object.geometry).inside(object.worldToLocal(q.clone())),'join point is inside actual journal/post material');
  }
 }

 for(const post of b.framePosts){const box=new T.Box3().setFromObject(post);assert.ok(Math.abs(box.min.y-bed.max.y)<1e-7);for(const x of[box.min.x,box.max.x])for(const z of[box.min.z,box.max.z])assert.ok(x>=bed.min.x&&x<=bed.max.x&&z>=bed.min.z&&z<=bed.max.z,'whole post foot lies on the bed');}
});
