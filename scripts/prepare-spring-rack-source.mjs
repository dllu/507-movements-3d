import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 first=JSON.parse(fs.readFileSync(base+'081-source-measurements.json')),refined=JSON.parse(fs.readFileSync(base+'081-source-measurements-refined.json'));
for(const r of [first,refined]){assert.equal(hash(r.image.file),r.image.sha256);for(const s of r.sources)assert.equal(hash(s.archive),s.sha256);}
assert.equal(refined.gear.installedTeeth,6);assert.equal(refined.rack.count,7);
assert(Object.values(refined.circles).every(c=>c.missing.length===0));
const fit=refined.gear.trialFits.find(f=>f.teeth===16);assert.equal(fit.rmsPixels,Math.min(...refined.gear.trialFits.map(f=>f.rmsPixels)));
const adopted={center:refined.circles.wheelOuter.center,scale:refined.circles.wheelOuter.radius,circles:refined.circles,
 rackTeeth:7,gearTeeth:6,virtualTeeth:16,pitch:refined.rack.unoccludedFit.pitch,rackUpperStrokeOrigin:refined.rack.unoccludedFit.origin,
 gearPhase:fit.phase,gearTipRadius:fit.radius,rod:refined.rod,
 assumptions:['Repeated rack pitch and gear divisions regularize the engraving. Five visible rack strokes set the pitch; the two partly occluded central strokes are excluded.',
 'Five gear tip strokes support six installed teeth on a sixteen-division pitch; only the fourth tip is inferred behind the rack.',
 'The gear, hub and spindle will share the fitted wheel center. Their separately measured source circles have small center offsets.',
 'Guide passages, a concealed sliding mandrel inside the hollow rack, axial layers, a shallow rear wheel flange and spring end construction are candidate reconstruction choices, not details proved by the engraving.']};
const moduleFile='scripts/lib/spring-rack-source.mjs';fs.writeFileSync(moduleFile,'// Adopted source measurements; artifacts/review/081-source-inspections.json.\nexport default '+JSON.stringify(adopted,null,2)+';\n',{flag:'wx'});
const sources=['scripts/prepare-spring-rack-source.mjs',moduleFile].map((file,i)=>{const archive=base+'081-adopted-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(file)};});
const report={movement:81,status:'source-measurements-adopted',created:new Date().toISOString(),productionChanged:false,mechanicsPassed:false,
 inspections:[{file:first.image.file,sha256:first.image.sha256,inspected:true,accepted:false,
 reason:'First overlay viewed. The seven-tooth interpretation sampled inner flanks and mistook a rack stroke for a second hidden gear tooth; ten inner shaft rays were clipped by the sampling interval.'},
 {file:refined.image.file,sha256:refined.image.sha256,inspected:true,accepted:true,
 reason:'Corrected overlay viewed. All four complete circle fits, seven rack strokes, five actual outer gear tip strokes and the one occluded gear tip are correctly located. Plate and spring rectangles remain manual centerline measurements.'}],
 selected:{file:base+'081-source-measurements-refined.json',sha256:hash(base+'081-source-measurements-refined.json')},adoptedModule:{file:moduleFile,sha256:hash(moduleFile)},
 geometry:{gearInstalled:6,gearVirtual:16,rackTeeth:7,pitch:adopted.pitch,gearPhase:fit.phase,gearTipAngularRmsPixels:fit.rmsPixels,
 gearTipAngularMaximumPixels:fit.maximumPixels,rackPitchRmsPixels:refined.rack.unoccludedFit.rms,gearOuterCircleRmsPixels:refined.circles.wheelOuter.rmsResidual},
 sources,mechanicalProfileAdopted:false,full507GoalStillActive:true};
fs.writeFileSync(base+'081-source-inspections.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(report.geometry);
