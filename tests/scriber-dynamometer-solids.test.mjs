import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';import{createAuthoredCylinderSpiralScriberMovement as f368}from'../src/simulation/authored-cylinder-spiral-scribers.js';import{createAuthoredDynamometerMovement as f372}from'../src/simulation/authored-dynamometers.js';import{solidSurface,surfacePoints}from'./helpers/solid-surface.mjs';
const c=JSON.parse(fs.readFileSync('src/data/movements.json')).movements,create=id=>(id===368?f368:f372)(c[id-1]);
const clear=(a,b)=>{const s=solidSurface(b.geometry),matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);for(const p of surfacePoints(a.geometry)){const q=p.clone().applyMatrix4(matrix);assert.ok(!s.inside(q)||s.distance(q)<1e-6,`${a.userData.role} into ${b.userData.role}`);}};
test('368 rack passes through its actual table slot and widened guide cheeks',()=>{
 const m=create(368),b=m.root.userData.blocks;
 for(let i=0;i<=8;i++){m.update(m.root.userData.timeline.demonstrationPeriod*i/16);m.root.updateMatrixWorld(true);for(const mesh of b.rack.children){clear(mesh,b.table);for(const guide of b.rackGuides)for(const cheek of guide.children)clear(mesh,cheek);}clear(b.cylinderShaft,b.table);clear(b.cylinderShaft,b.verticalBearing);clear(b.inputShaft,b.driverBevel.userData.body);clear(b.cylinderShaft,b.drivenBevel.userData.body);}
});
test('372 loose sleeves and end bearings have coaxial finite bores, with the shaft index clear',()=>{
 const m=create(372),b=m.root.userData.blocks;
 for(let i=0;i<=8;i++){m.update(m.root.userData.geometry.inputPeriod*i/8);m.root.updateMatrixWorld(true);for(const part of[b.inputSleeve,b.carrierBoss,...b.shaftBearings]){clear(b.outputShaft,part);clear(b.outputShaftIndex,part);}}
});
test('372 cylindrical carrier arms seat through planet bores and clear all gear bodies',()=>{
 const m=create(372),b=m.root.userData.blocks;
 for(let i=0;i<=8;i++){m.update(m.root.userData.geometry.inputPeriod*i/8);m.root.updateMatrixWorld(true);for(const arm of[...b.carrierArms,...b.carrierCrossArms])for(const gear of[b.inputGear,b.outputGear,b.topPlanetGear,b.bottomPlanetGear])clear(arm,gear.userData.body);}
 for(const arm of b.carrierArms){assert.equal(arm.geometry.parameters.radiusTop,.068);assert.ok(Math.abs(arm.position.y)-arm.geometry.parameters.height/2<.27);assert.ok(Math.abs(arm.position.y)+arm.geometry.parameters.height/2>.94);}
});
test('368/372 actual back-cone profiles have sufficient addendum contact and finite teeth',()=>{
 for(const id of[368,372]){const m=create(id),b=m.root.userData.blocks,gears=id===368?[b.driverBevel,b.drivenBevel]:[b.inputGear,b.outputGear];let reach=0,basePitch,center=0;
 for(const gear of gears){const u=gear.userData,t=u.toothMeshes[0].geometry.userData,r=u.outerPitchRadius/Math.cos(u.pitchConeAngle),module=2*u.outerPitchRadius/u.teeth,alpha=Math.PI/9;reach+=Math.sqrt((r+.45*t.height)**2-(r*Math.cos(alpha))**2);center+=r;basePitch=Math.PI*module*Math.cos(alpha);assert.equal(u.toothProfile,'back-cone-involute-approximation');}
 assert.ok((reach-center*Math.sin(Math.PI/9))/basePitch>1);if(id===368){const g=m.root.userData.geometry,alpha=25*Math.PI/180,r=g.spurPitchRadius,ratio=(Math.sqrt((r+.042)**2-(r*Math.cos(alpha))**2)-r*Math.sin(alpha)+.042/Math.sin(alpha))/(Math.PI*g.spurModule*Math.cos(alpha));assert.ok(ratio>1.08);}assert.equal(m.root.userData.hideGround,true);m.root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)assert.equal(material.fog,false);});}
});
test('saved full-solid contact study matches final production and records finite engagement gaps',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/368-372-contact-solids.json'));for(const s of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,s.file);
 for(const r of report.results){assert.equal(r.poses,33);assert.equal(r.penetrations,0);assert.ok(r.queries>400000);// 372's miters keep only Brown's outer tooth band (inner end at 0.62 of the
 // 0.94 cone distance), so the smallest sampled backlash is the .96-thickness
 // clearance at that larger inner radius, about 0.004.
 for(const p of r.pairs){assert.ok(p.minimumSampledGap>0);assert.ok(p.maximumSampledGap<(r.id===372?.005:.002));}}
});
