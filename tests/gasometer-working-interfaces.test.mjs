import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredGasometerMovement } from '../src/simulation/authored-gasometers.js';
import { solidSurface, surfacePoints, surfaceTriangles } from './helpers/solid-surface.mjs';

const make = id => createAuthoredGasometerMovement({ id, sourceUrl: `https://507movements.com/mm_${id}.html` });
for (const id of [479, 480]) {
  test(`${id}: finite vessel, guide, rope and pipe interfaces over a full cycle`, () => {
    const model = make(id), b = model.root.userData.blocks, p = model.root.userData.gasometerWorkingParts;
    const pairs = p.pipes.map(pipe => [pipe, b.tankBottom]);
    if (id === 479) {
      for (let i = 0; i < 2; i++) {
        for (const rope of [b.ropeArcs[i], b.innerRopeSegments[i], b.outerRopeSegments[i]]) pairs.push([rope, p.grooves[i]]);
        pairs.push([p.axles[i], p.hubs[i]]);
        for (const weight of b.counterweights[i].children) for (const tank of [b.tankWall, b.tankTopRim]) pairs.push([weight, tank]);
      }
    } else {
      pairs.push([b.fixedTubeShell, b.movingTubeShell], [b.fixedTubeShell, b.bellCrown],
        ...b.movingTubeRims.map(rim => [b.fixedTubeShell, rim]),
        [b.gasDome, b.movingTubeShell], [b.gasDome, b.fixedTubeShell]);
    }
    for (const bell of [b.bellSkirt, b.bellBottomRim]) for (const tank of [b.tankWall, b.tankBottom, b.tankTopRim]) pairs.push([bell, tank]);
    const samples = new Map(), solids = new Map();
    for (const [a, b] of pairs) {
      if (!samples.has(a)) samples.set(a, surfacePoints(a.geometry));
      if (!solids.has(b)) solids.set(b, solidSurface(b.geometry));
    }
    // Long pipe faces can straddle a thin floor without their vertices or
    // midpoints lying inside it. Sample their actual triangular sections at
    // three floor heights, so the old unbored-floor regression is detected.
    for (const pipe of p.pipes) for (const offset of [-0.08, 0, 0.08]) {
      const y = b.tankBottom.position.y + offset - pipe.position.y;
      for (const tri of surfaceTriangles(pipe.geometry)) for (const [a,c] of [[tri.a,tri.b],[tri.b,tri.c],[tri.c,tri.a]]) {
        if (a.y === c.y || (y-a.y)*(y-c.y) > 0) continue;
        samples.get(pipe).push(a.clone().lerp(c,(y-a.y)/(c.y-a.y)));
      }
    }
    let checks = 0, min = Infinity;
    for (let pose = 0; pose <= 16; pose++) {
      model.update(pose * 8 / 16); model.root.updateMatrixWorld(true);
      for (const [a, b] of pairs) {
        const matrix = b.matrixWorld.clone().invert().multiply(a.matrixWorld), solid = solids.get(b);
        for (const local of samples.get(a)) {
          const q = local.clone().applyMatrix4(matrix), d = solid.signedDistance(q, 0.005);
          min = Math.min(min, d); checks++;
          assert.ok(d >= -1e-5, `${id} pose ${pose}: ${a.userData.role} cuts ${b.userData.role} by ${-d} at ${q.toArray()}`);
        }
      }
    }
    console.log(JSON.stringify({ id, checks, minimumCappedGap: min }));
  });
  test(`${id}: closed walls have physical thickness and correct normals`, () => {
    const { root } = make(id), b = root.userData.blocks;
    for (const mesh of [b.tankWall, b.bellSkirt, b.bellCrown]) {
      const p = mesh.geometry.attributes.position, ix = mesh.geometry.index;
      let volume = 0;
      for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
        const [a,b,c] = [0,1,2].map(j => new THREE.Vector3().fromBufferAttribute(p, ix ? ix.getX(i+j) : i+j));
        volume += a.dot(new THREE.Vector3().crossVectors(b,c)) / 6;
      }
      assert.ok(volume > 0.01, `${mesh.userData.role}: ${volume}`);
    }
  });
  test(`${id}: stable scene geometry during updates, explicit timing and force assumptions`, () => {
    const model = make(id), before = [];
    model.root.traverse(o => { if(o.geometry) before.push([o, o.geometry, o.geometry.attributes.position.array]);
      for (const material of [].concat(o.material ?? [])) {
        assert.equal(material.fog, false);
        if (material.transparent) { assert.equal(o.castShadow,false); assert.equal(o.receiveShadow,false); }
      } });
    for(let i=0;i<=32;i++) model.update(i/4);
    let count=0;model.root.traverse(o=>{if(o.geometry) count++;});
    assert.equal(count,before.length);
    for(const[o,g,array]of before){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,array);}
    assert.equal(model.root.userData.minimumDisplayCycleSeconds,8);
    assert.equal(model.root.userData.hideGround,true);
    assert.match(model.root.userData.reconstructionNote,/prescribed/);
    assert.match(model.root.userData.reconstructionNote,/not dynamically solved/);
  });
}
