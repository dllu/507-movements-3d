import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeHeldSideDifferential } from '../src/simulation/held-side-differential.js';
import { surfaceTriangles, surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from '../scripts/lib/star-mangle-pair-distance.mjs';

const model = makeHeldSideDifferential(), { parts, blocks, geometry: p, motion } = model.root.userData;
const setTime = time => { model.update(time); model.root.updateMatrixWorld(true); };
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);

test('061 has nineteen closed solids with consistent outward normals and independent bearings', () => {
  for (const [name, mesh] of Object.entries(parts)) {
    const g = mesh.geometry, edges = new Map(); let volume = 0;
    for (const [i, face] of surfaceTriangles(g).entries()) {
      assert.ok(face.getArea() > 1e-20, `${name}: nonzero face`);
      const normal = face.getNormal(new THREE.Vector3());
      for (let j = 0; j < 3; j += 1) {
        const index = g.index ? g.index.getX(3 * i + j) : 3 * i + j;
        assert.ok(normal.dot(new THREE.Vector3().fromBufferAttribute(g.attributes.normal, index)) > 0, `${name}: outward corner normal`);
      }
      volume += face.a.dot(face.b.clone().cross(face.c)) / 6;
      const keys = [face.a, face.b, face.c].map(v => v.toArray().map(x => Math.round(x * 1e7)).join(','));
      for (let j = 0; j < 3; j += 1) {
        const a = keys[j], b = keys[(j + 1) % 3], key = a < b ? `${a}/${b}` : `${b}/${a}`;
        const edge = edges.get(key) ?? { count: 0, direction: 0 };
        edge.count += 1; edge.direction += a < b ? 1 : -1; edges.set(key, edge);
      }
    }
    assert.ok(volume > 0, `${name}: positive volume`);
    assert.ok([...edges.values()].every(e => e.count === 2 && e.direction === 0), `${name}: closed oriented edges`);
  }
  assert.equal(Object.keys(parts).length, 19);
  for (const [name, top, bottom] of [['driverDrum',119,668],['loosePulley',814,1354],
    ['directPulley',807,1354],['carrierPulley',808,1356],['brakeDrum',997,1156]]) {
    setTime(0); const box = new THREE.Box3().setFromObject(parts[name],true);
    assert.ok(Math.abs(1078.5 - 200 * box.max.y - top) < 10);
    assert.ok(Math.abs(1078.5 - 200 * box.min.y - bottom) < 10);
  }
  for (const gear of Object.values(model.root.userData.gears)) {
    const { pitchConeAngle: delta, innerDistance, outerDistance, mesh } = gear.userData;
    const outer = outerDistance / Math.cos(delta) ** 2, inner = innerDistance / Math.cos(delta) ** 2;
    for (let i=0;i<mesh.geometry.attributes.position.count;i+=1) {
      const point = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);
      const end = point.z + Math.hypot(point.x,point.y) * Math.tan(delta);
      assert.ok(Math.min(Math.abs(end-inner),Math.abs(end-outer)) < 2e-7,
        'every heel/toe vertex lies on a cone normal to the pitch generator');
    }
  }
});

test('061 bores, planet spindle and supporting webs clear independently moving members', () => {
  const pairs = [['outputShaft', 'loosePulley'], ['outputShaft', 'brakeGearBody'],
    ['brakeGearBody', 'carrierPulley'], ['planetSpindle', 'planetBody'],
    ['innerSpindleCollar', 'planetBody'], ['outerSpindleCollar', 'planetBody'],
    ['carrierPulley', 'brakeGearTeeth'], ['outputShaft', 'planetSpindle']];
  const data = Object.fromEntries([...new Set(pairs.flat())].map(name => [name,
    { mesh: parts[name], solid: solidSurface(parts[name].geometry), points: surfacePoints(parts[name].geometry), tree: triangleTree(parts[name].geometry) }]));
  for (const time of [0.811, 4.127, 7.91]) {
    setTime(time);
    for (const [first, second] of pairs) {
      const a = data[first], b = data[second], transform = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      const contact = meshPairDistance(a.tree, b.tree, transform, 0.01);
      assert.ok(contact.distance > 0.004, `${first}/${second}: genuine skin clearance, including crossed-shaft failure mode`);
      for (const [from, to] of [[a, b], [b, a]]) {
        const matrix = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
        for (const point of from.points) assert.equal(to.solid.inside(point.clone().applyMatrix4(matrix)), false,
          `${first}/${second}: no full containment in a false solid bore`);
      }
    }
  }
});

test('061 actual opposed bevel flanks transmit both torque directions through a tooth period', () => {
  const sourceTree = triangleTree(parts.planetTeeth.geometry);
  for (const name of ['outputGearTeeth', 'brakeGearTeeth']) for (const direction of [-1, 1]) {
    const axisSign = name === 'outputGearTeeth' ? -1 : 1;
    const faces = surfaceTriangles(parts[name].geometry).filter(face => {
      const center = face.getMidpoint(new THREE.Vector3()), normal = face.getNormal(new THREE.Vector3());
      return direction * axisSign * -center.clone().cross(normal).z > 0.1 * Math.hypot(center.x, center.y);
    });
    const targetTree = triangleTree(new THREE.BufferGeometry().setFromPoints(faces.flatMap(({ a,b,c }) => [a,b,c])));
    for (let i = 0; i < 9; i += 1) {
      const progress = (2 * Math.PI / p.sideTeeth) / p.driverTurnPerDwell * (i + 0.317) / 9;
      let low = 0, high = 1;
      for (let step = 0; step < 50; step += 1) {
        const u = (low + high) / 2;
        if (u ** 3 * (10 - 15 * u + 6 * u ** 2) < progress) low = u; else high = u;
      }
      setTime(2 * p.stageDuration + p.dwellDuration * (low + high) / 2);
      const state = model.root.userData.kinematics, a = parts.planetTeeth, b = parts[name];
      const contact = meshPairDistance(sourceTree, targetTree, b.matrixWorld.clone().invert().multiply(a.matrixWorld), 0.001);
      assert.ok(contact.witness && contact.distance > 0.00002 && contact.distance < 0.00008);
      const pa = new THREE.Vector3().fromArray(contact.witness.a).applyMatrix4(b.matrixWorld);
      const pb = new THREE.Vector3().fromArray(contact.witness.b).applyMatrix4(b.matrixWorld);
      const normal = pb.clone().sub(pa).normalize(), apex = new THREE.Vector3(0,0,p.bevelCenterZ);
      const axis = new THREE.Vector3(Math.cos(state.carrierAngle),Math.sin(state.carrierAngle),0);
      const torqueA = pa.clone().sub(apex).cross(normal.clone().negate()).dot(axis);
      const torqueB = pb.clone().sub(apex).cross(normal).z;
      assert.ok(direction * torqueB > 0, 'the actual compressive normal provides the requested torque direction');
      const powerA = torqueA * state.planetSpeed;
      const powerB = torqueB * ((name === 'outputGearTeeth' ? state.outputSpeed : 0) - state.carrierSpeed);
      assert.ok(Math.abs(powerA + powerB) / Math.max(Math.abs(powerA),Math.abs(powerB)) < 0.004,
        'actual contact normals conserve pairwise power in the carrier frame within tessellation error');
    }
  }
});

test('061 flat selector band and weighted friction curb retain actual working contact', () => {
  const names = ['belt','driverDrum','loosePulley','directPulley','carrierPulley','frictionBand','brakeDrum'];
  const trees = Object.fromEntries(names.map(name => [name,triangleTree(parts[name].geometry)]));
  const check = (a,b) => {
    const contact = meshPairDistance(trees[a],trees[b],parts[b].matrixWorld.clone().invert().multiply(parts[a].matrixWorld),0.001);
    assert.ok(contact.witness && contact.distance > 0.00012 && contact.distance < 0.00020, `${a}/${b}: working surface gap`);
  };
  const lower = ['loosePulley','directPulley','carrierPulley'];
  for (let stage=0;stage<4;stage+=1) for (const shift of [false,true]) {
    setTime(stage*p.stageDuration+(shift?p.dwellDuration+p.shiftDuration/2:0.811));
    const state=model.root.userData.kinematics;
    check('belt','driverDrum'); check('belt',lower[state.selected]);
    if (shift) { check('belt',lower[state.next]); near(state.driverSpeed,0); near(state.outputSpeed,0); }
    else {
      near(state.outputSpeed,state.selected*state.driverSpeed);
      near(state.carrierSpeed,state.outputSpeed/2);
      const lowerSpeed=state.selected===0?state.looseSpeed:state.selected===1?state.outputSpeed:state.carrierSpeed;
      near(lowerSpeed,state.driverSpeed);
      const curve=parts.belt.userData.curve;
      for(let i=0;i<256;i+=1) {
        const u=(i+0.371)/256,q=curve.getPointAt(u),tangent=curve.getTangentAt(u);
        if(q.y >= -0.1 || Math.abs(Math.hypot(q.x,q.y)-p.beltPitchRadius)>1e-8) continue;
        near(tangent.x*state.beltLinearSpeed,-lowerSpeed*q.y,1e-8);
        near(tangent.y*state.beltLinearSpeed,lowerSpeed*q.x,1e-8);
      }
    }
    check('frictionBand','brakeDrum'); near(state.brakeSpeed,0);
  }
});

test('061 motion and material flow are repeatable and independent of the section display', () => {
  const groups=['driver','output','loose','carrier','brake','planet'],dt=1e-5;
  const boundaries=p.selectionSequence.flatMap((_,stage)=>[stage*p.stageDuration,stage*p.stageDuration+p.dwellDuration]);
  for(const time of [-31.37,-2.11,0.731,2.85,4.127,7.91,10.71,17.61,...boundaries]) {
    setTime(time-dt); const before=groups.map(name=>blocks[name].rotation.z),beforeState=model.root.userData.kinematics;
    setTime(time+dt); const after=groups.map(name=>blocks[name].rotation.z),afterState=model.root.userData.kinematics;
    setTime(time);const state=model.root.userData.kinematics;
    groups.forEach((name,i)=>near((after[i]-before[i])/(2*dt),state[`${name}Speed`],2e-7));
    near((afterState.beltZ-beforeState.beltZ)/(2*dt),state.beltAxialSpeed,2e-7);
    near((afterState.beltDistance-beforeState.beltDistance)/(2*dt),state.beltLinearSpeed,2e-7);
    const matrices=Object.values(parts).map(mesh=>mesh.matrixWorld.clone()),colors=parts.belt.geometry.attributes.color.array.slice();
    setTime(time+9.317);setTime(time);
    for(const section of [false,true]) {
      model.root.userData.setSectionView(section);model.root.updateMatrixWorld(true);
      Object.values(parts).forEach((mesh,i)=>assert.ok(mesh.matrixWorld.equals(matrices[i])));
      assert.deepEqual(parts.belt.geometry.attributes.color.array,colors);
      assert.equal(model.root.userData.sectionCaps.visible,section);
      assert.ok(model.root.userData.sectioned.every(mesh=>mesh.material.clippingPlanes.length===(section?1:0)));
    }
  }
  for(const time of boundaries) {
    const a=motion.atTime(time-dt),b=motion.atTime(time+dt);
    near(a.driverSpeed,0,1e-8);near(b.driverSpeed,0,1e-8);
    near((b.driverSpeed-a.driverSpeed)/(2*dt),0,0.0001);
    near((b.beltAxialSpeed-a.beltAxialSpeed)/(2*dt),0,0.0002);
  }
});
