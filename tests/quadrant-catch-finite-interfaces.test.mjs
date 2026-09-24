import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredQuadrantCatchMovement as create } from '../src/simulation/authored-quadrant-catches.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

for (const id of [183, 184]) {
  test(`${id}: bored moving plates, hubs and connected sleeves clear real fixed shafts`, () => {
    const m = create({ id }), d = m.root.userData, b = d.blocks, p = d.quadrantFiniteInterfaces;
    const pairs = [];
    for (let side = 0; side < 2; side++) {
      const name = side ? 'lower' : 'upper', shaft = b[`${name}PivotShaft`];
      for (const to of [...p.boredPlates.slice(4*side,4*side+4), b[`${name}HandleHub`], p.sleeves[side], p.journals[side], b.frameSpine]) pairs.push([shaft, to]);
    }
    const fields = new Map(), points = new Map();
    for (const pair of pairs) for (const o of pair) { if (!fields.has(o)) { fields.set(o, solidSurface(o.geometry)); points.set(o, surfacePoints(o.geometry)); } }
    let minimum = .02;
    for (let i=0;i<=64;i++) {
      m.update(d.geometry.cyclePeriod*i/64); m.root.updateMatrixWorld(true);
      for (const [a,b] of pairs) for (const [from,to] of [[a,b],[b,a]]) {
        const matrix = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
        for (const q of points.get(from)) minimum = Math.min(minimum, fields.get(to).signedDistance(q.clone().applyMatrix4(matrix), .02));
      }
    }
    assert.ok(minimum > .004, `shaft/bore minimum ${minimum}`); console.log({ id, shaftClearance: minimum });
  });

  test(`${id}: formerly crossed handle plates and hubs occupy disjoint finite layers`, () => {
    const m=create({id}),d=m.root.userData,b=d.blocks;
    const meshes = side => [b[`${side}HandleHub`],b[`${side}HandleWorkingTip`],
      ...['WorkingArm','WeightArm'].map(k=>b[`${side}Handle${k}`].children.find(o=>/-plate$/.test(o.userData.role)))];
    for(let i=0;i<=64;i++){
      m.update(d.geometry.cyclePeriod*i/64);m.root.updateMatrixWorld(true);
      const upper=Math.max(...meshes('upper').map(o=>new THREE.Box3().setFromObject(o).max.z)),
        lower=Math.min(...meshes('lower').map(o=>new THREE.Box3().setFromObject(o).min.z));
      assert.ok(lower-upper>.12,`${i}: ${upper}/${lower}`);
    }
  });

  test(`${id}: hanging-weight pins use actual bores in eyes and arm ends`, () => {
    const m=create({id}),d=m.root.userData,b=d.blocks;let minimum=.02;
    for(const side of ['upper','lower']){
      const pin=b[`${side}WeightConnector`],body=b[`${side}Handle`],eye=body.children.find(o=>/back-weight-eye$/.test(o.userData.role)),
        arm=b[`${side}HandleWeightArm`].children.find(o=>/-plate$/.test(o.userData.role));
      const field=solidSurface(pin.geometry);
      for(let i=0;i<=32;i++){
        m.update(d.geometry.cyclePeriod*i/32);m.root.updateMatrixWorld(true);
        for(const part of[eye,arm]){const matrix=pin.matrixWorld.clone().invert().multiply(part.matrixWorld);
          for(const p of surfacePoints(part.geometry))minimum=Math.min(minimum,field.signedDistance(p.applyMatrix4(matrix),.02));}
      }
    }
    assert.ok(minimum>.005,`weight hinge gap ${minimum}`);console.log({id,weightHingeClearance:minimum});
  });

  test(`${id}: support sleeves join the hub and quadrant spokes across inferred depth`, () => {
    const m=create({id}),b=m.root.userData.blocks,p=m.root.userData.quadrantFiniteInterfaces;m.root.updateMatrixWorld(true);
    for(let i=0;i<2;i++){
      const side=i?'lower':'upper',sleeve=p.sleeves[i],field=solidSurface(sleeve.geometry);
      for(const part of[b[`${side}HandleHub`],b[`${side}QuadrantStartSpoke`].children.find(o=>/-plate$/.test(o.userData.role)),b[`${side}QuadrantEndSpoke`].children.find(o=>/-plate$/.test(o.userData.role))]){
        const matrix=sleeve.matrixWorld.clone().invert().multiply(part.matrixWorld),reverse=matrix.clone().invert(),other=solidSurface(part.geometry),
          depth=Math.min(...surfacePoints(part.geometry).map(q=>field.signedDistance(q.applyMatrix4(matrix),.05)),
            ...surfacePoints(sleeve.geometry).map(q=>other.signedDistance(q.applyMatrix4(reverse),.05)));
        assert.ok(depth<-.005,`${side} disconnected ${part.userData.role}: ${depth}`);
      }
    }
  });

  test(`${id}: source rod section stays continuous behind both handles with stable full-cycle framing`, () => {
    const m=create({id}),d=m.root.userData,b=d.blocks,resources=[],point=new THREE.Vector3();
    m.root.traverse(o=>{if(o.geometry)resources.push([o,o.geometry,o.geometry.attributes.position.array]);});
    let extent;
    for(let i=0;i<=64;i++){
      m.update(d.geometry.cyclePeriod*i/64);m.root.updateMatrixWorld(true);
      const rod=new THREE.Box3().setFromObject(b.pistonRod),tappet=new THREE.Box3().setFromObject(b.tappet);
      // The shoe seats on the rod's front face (touching, not interpenetrating).
      assert.ok(rod.clone().expandByScalar(1e-6).intersectsBox(tappet),'finite rod connects to shoe');
      if(extent)assert.ok(rod.min.distanceTo(extent.min)<1e-10&&rod.max.distanceTo(extent.max)<1e-10);extent=rod;
      m.root.traverseVisible(o=>{const a=o.geometry?.attributes.position;if(a)for(let j=0;j<a.count;j++)assert.ok(d.cameraFitBounds.containsPoint(point.fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld)));});
    }
    assert.ok(extent.getSize(point).x>.399&&point.y>6.2);
    for(const[o,g,a]of resources){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,a);}
    assert.equal(b.pistonGuide.visible,false);assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,12);
    assert.equal(d.cameraDirection.x,0);assert.match(d.reconstructionNote,/still interfere.*unresolved/);
  });
}

test('183/184: connected sleeve stock clears the opposite curved working arm', () => {
  const m=create({id:183}),d=m.root.userData,b=d.blocks;let minimum=.02;
  for(let i=0;i<2;i++){
    const sleeve=d.quadrantFiniteInterfaces.sleeves[i],opposite=b[`${i?'upper':'lower'}HandleWorkingArm`].children.find(o=>/-plate$/.test(o.userData.role)),
      sf=solidSurface(sleeve.geometry),af=solidSurface(opposite.geometry),sp=surfacePoints(sleeve.geometry),ap=surfacePoints(opposite.geometry);
    for(let j=0;j<=128;j++){
      m.update(d.geometry.cyclePeriod*j/128);m.root.updateMatrixWorld(true);
      const matrix=sleeve.matrixWorld.clone().invert().multiply(opposite.matrixWorld),reverse=matrix.clone().invert();
      for(const q of ap)minimum=Math.min(minimum,sf.signedDistance(q.clone().applyMatrix4(matrix),.02));
      for(const q of sp)minimum=Math.min(minimum,af.signedDistance(q.clone().applyMatrix4(reverse),.02));
    }
  }
  assert.ok(minimum>1e-5,`opposite working arm/sleeve gap ${minimum}`);console.log({oppositeSleeveClearance:minimum});
});
