import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';import{createAuthoredEllipticalIdlerGearMovement as factory}from'../src/simulation/authored-elliptical-idler-gears.js';import{solidSurface,surfacePoints,surfaceTriangles}from'./helpers/solid-surface.mjs';
import{createAuthoredSteppedSectorGearMovement as sectorFactory}from'../src/simulation/authored-stepped-sector-gears.js';
const c=JSON.parse(fs.readFileSync('src/data/movements.json')).movements,create=id=>factory(c[id-1]);
const clear=(a,b)=>{const s=solidSurface(b.geometry),matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);for(const p of surfacePoints(a.geometry)){const q=p.clone().applyMatrix4(matrix);assert.ok(!s.inside(q)||s.distance(q)<1e-6,`${a.userData.role} into ${b.userData.role}`);}};
test('221 finite roller and spindle clear the groove floor and walls through the whole cycle',()=>{
 const m=create(221),b=m.root.userData.blocks;for(let i=0;i<=16;i++){m.update(m.root.userData.transmission.driverCyclePeriod*i/16);m.root.updateMatrixWorld(true);for(const guide of[b.guideFloor,b.guideOuterRail,b.guideInnerIsland]){clear(b.guideRoller,guide);clear(b.compoundSpindle,guide);clear(b.outputShaft.userData.rotor.children[0],guide);}clear(b.compoundSpindle,b.carrierBeam.userData.boredMesh);}
});
test('222 eccentric bore and two actual link eyes clear the shafts at every sampled input pose',()=>{
 const m=create(222),b=m.root.userData.blocks;for(let i=0;i<=16;i++){m.update(m.root.userData.transmission.driverCyclePeriod*i/16);m.root.updateMatrixWorld(true);clear(b.driverShaft.userData.rotor.children[0],b.driverGear.userData.rotor.children[0]);clear(b.driverCenterJoint,b.driverLink.userData.boredMesh);clear(b.outputShaft.userData.rotor.children[0],b.outputLink.userData.boredMesh);for(const link of[b.driverLink,b.outputLink])clear(b.idlerShaft.userData.rotor.children[0],link.userData.boredMesh);clear(b.driverLink.userData.boredMesh,b.outputLink.userData.boredMesh);}
});
test('saved full-cycle profiles agree with production and disclose223 handoff gaps',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/221-222-223-contact.json'));for(const s of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,s.file);
 for(const r of report.results){assert.equal(r.penetratingPairPoses,0);assert.ok(r.poses>=513);assert.ok(r.maximumActiveGap<(r.id===223?.007:.002));}
});

test('223 bored sector stacks clear their shafts and disclose prescribed handoffs',()=>{
 const m=sectorFactory(c[222]),b=m.root.userData.blocks;m.root.updateMatrixWorld(true);
 for(const [shaft,sectors] of[[b.driverShaft,b.driverSectors],[b.outputShaft,b.outputSectors]])for(const sector of sectors){clear(shaft.userData.rotor.children[0],sector.children[0]);if(sector.children[1].visible)clear(shaft.userData.rotor.children[0],sector.children[1]);}
 assert.match(m.root.userData.reconstructionNote,/continuous loaded engagement is not modeled/);
 assert.equal(m.root.userData.hideGround,true);
 m.root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)assert.equal(material.fog,false);});
});

test('baked 221 and223 bore walls have normals pointing into the empty bore',()=>{
 const a=create(221),b=sectorFactory(c[222]);
 for(const [mesh,radius]of[[a.root.userData.blocks.driverBody,.15],...b.root.userData.blocks.outputSectors.map(s=>[s.children[0],.107])]){let walls=0;for(const triangle of surfaceTriangles(mesh.geometry)){const center=triangle.getMidpoint(new (a.root.position.constructor)()),normal=triangle.getNormal(center.clone());if(Math.hypot(center.x,center.y)<radius+1e-5&&Math.abs(normal.z)<1e-8){assert.ok(normal.x*center.x+normal.y*center.y<0);walls++;}}assert.ok(walls>100);}
});
