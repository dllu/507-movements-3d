import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements;
function clear(a,b){const surface=solidSurface(b.geometry),matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);for(const p of surfacePoints(a.geometry)){const q=p.clone().applyMatrix4(matrix);assert.ok(!surface.inside(q)||surface.distance(q)<1e-6,`${a.userData.role} into ${b.userData.role}`);}}
for(const id of[200,226])test(`${id} has working-depth back-cone involutes and fog-free materials`,()=>{
 const m=createAuthoredGearMovement(catalog[id-1]),b=m.root.userData.blocks,pairs=id===200?[[b.driver,b.upperOutput],[b.driver,b.lowerOutput]]:[[b.inputGearB,b.shaftGearF]];
 for(const[a,z]of pairs){const x=a.userData,y=z.userData,rv=x.outerPitchRadius/Math.cos(x.pitchConeAngle),rw=y.outerPitchRadius/Math.cos(y.pitchConeAngle),alpha=Math.PI/9,module=2*x.outerPitchRadius/x.teeth;
  const ratio=(Math.sqrt((rv+.45*x.toothHeight)**2-(rv*Math.cos(alpha))**2)+Math.sqrt((rw+.45*y.toothHeight)**2-(rw*Math.cos(alpha))**2)-(rv+rw)*Math.sin(alpha))/(Math.PI*module*Math.cos(alpha));assert.ok(ratio>1.55);assert.ok(Math.abs(module-2*y.outerPitchRadius/y.teeth)<1e-12);
 }
 m.root.traverse(o=>{for(const mat of(Array.isArray(o.material)?o.material:[o.material]))if(mat)assert.equal(mat.fog,false);if(o.geometry)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});assert.equal(m.root.userData.hideGround,true);assert.ok(m.root.userData.minimumDisplayCycleSeconds>=12);disposeObject3D(m.root);
});
test('226 crossing hubs clear through a full carrier revolution and shafts occupy their actual bores',()=>{
 const m=createAuthoredGearMovement(catalog[225]),b=m.root.userData.blocks;
 const pairs=[[b.inputGearB,b.shaftGearF],[b.inputGearB,b.hollowDriveGear],[b.planetGearD,b.sideGearC],[b.planetGearD,b.outputGearE]];
 for(let i=0;i<=8;i++){m.update(6*i/8);m.root.updateMatrixWorld(true);for(const[a,z]of pairs){clear(a.userData.hub,z.userData.hub);clear(z.userData.hub,a.userData.hub);}clear(b.planetAxle.userData.rotor.children[0],b.shaftF.userData.rotor.children[0]);}
 for(const[gear,shaftR]of[[b.inputGearB,.09],[b.shaftGearF,.078],[b.planetGearD,.066],[b.sideGearC,.168],[b.outputGearE,.17]])assert.ok(gear.userData.boreRadius>shaftR&&gear.userData.boreRadius-shaftR<.00201);
 // p93: frame A is centred on F; its end-bar bosses and D's spider boss are carried with it.
 assert.equal(b.frameBossesA.length,2);assert.ok([...b.frameBossesA,b.spiderBossD].every(p=>p.parent===b.carrierAssembly));disposeObject3D(m.root);
});
test('saved bevel contact audit matches production and keeps all six meshes close',()=>{
 const r=JSON.parse(fs.readFileSync('docs/validation/200-226-bevel-solids.json'));for(const s of r.sources)assert.equal(createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,s.file);
 assert.equal(r.results.length,2);for(const row of r.results){assert.equal(row.poses,33);assert.equal(row.penetrations,0);assert.ok(row.queries>500000);for(const p of row.pairs)assert.ok(p.maximumSampledGap<.002);}
});

test('226 frame A is one broad flat frame centred on F with bored bosses on its end bars', () => {
  const m = createAuthoredGearMovement({id: 226}), b = m.root.userData.blocks, g = m.root.userData.geometry;
  b.flatFrameA.geometry.computeBoundingBox();
  const frame = b.flatFrameA.geometry.boundingBox;
  assert.ok(frame.max.z - frame.min.z > 0.13, 'frame is a bar, not a film');
  assert.ok(Math.abs(frame.max.z + frame.min.z) < 1e-9, 'centred on F');
  assert.ok(g.flatFrameBand > 0.25, 'broad band');
  for (const boss of b.frameBossesA) {
    const box = new THREE.Box3().setFromObject(boss);
    assert.ok(box.max.y - box.min.y > 0.39, 'end-bar boss is round and broad');
  }
  disposeObject3D(m.root);
});
