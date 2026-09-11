import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 read=name=>JSON.parse(fs.readFileSync(base+name+'.json')),verify=s=>assert.equal(hash(s.archive??s.file),s.sha256,s.file),
 frozen=read('080-verification-source-hashes'),surface=read('081-baseline-surfaces'),captures=read('081-baseline-captures');
for(const [file,expected]of Object.entries(frozen))assert.equal(hash(file),expected,file);
assert.equal(read('080-integrated-checkpoint').mechanicsPassed,true);
for(const source of [...surface.sources,...captures.sources])verify(source);
assert.equal(surface.penetrations,1688884);assert.equal(captures.captures.length,9);assert.equal(captures.errors.length,0);
const views=captures.captures.map(c=>{verify(c);return {...c,inspected:true,visualAccepted:false,
 qualification:'Viewed beside the enlarged Brown source. Excessive rack tooth count, undersized wheel, shortened spring, long lower rod and unsupported rear frame/markers depart from the source. The spring flattens during release and the lower guide is a solid block. Front, drive/release/return, oblique and rear views are rejected as the final reconstruction.'};});
const groups={};for(const row of surface.rows){const key=row.a.startsWith('gear')?'gearRack':row.a==='spring'?'springHardware':'rackGuides',
 group=groups[key]??={pairs:0,checks:0,penetrations:0,maximumDepth:0};group.pairs++;group.checks+=row.checks;group.penetrations+=row.penetrations;group.maximumDepth=Math.max(group.maximumDepth,row.maximumDepth);}
const notes=`# Movement 081 reconstruction review

The original model is rejected. Nine baseline views and the enlarged source crop are inspected; no replacement has been implemented. Movement 080 is now verified, and the complete 507-movement review remains active.

The [official source](https://507movements.com/mm_081.html) describes continuous rotation of mutilated spur gear A lifting rack rod B, with spiral spring C returning the rod when the gear teeth release. The [Brown crop](../reference/brown-081-detail.png) is taken from PDF page 28, printed page 24, at [1780,2520,1280,1300]. It shows a slender rack rod, a short coarse toothed section, a partly toothed wheel, a compression spring around the upper rod, a top spring seat, a moving collar and a lower guide. The clockwise arrow gives upward drive at the wheel's left contact. Tooth count, circle centers, pitch and spring dimensions have not yet been fitted.

The [front baseline](081-baseline-source.png), [release](081-baseline-release.png), [oblique](081-baseline-oblique.png) and [rear](081-baseline-rear.png) differ substantially. The model adds a tall rear post, base and bridges, uses seventeen fine rack teeth and a relatively small wheel, shortens the visible spring and extends the lower rod far beneath its guide. Its gear teeth have straight trapezoidal flanks; the rack teeth are rectangles. Both require real compatible involute engagement. The lower guide is solid, with a painted opening. The spring is an uncapped tube scaled along its axis, which changes the wire section as well as the pitch.

The [surface screen](081-baseline-surfaces.json) covers 135 poses and 152 selected independent pairs. Of 43,082,800 actual surface checks, 1,688,884 penetrate beyond 1e-6: 7,006 gear/rack checks, 405 rack/guide checks and 1,681,473 spring/hardware checks. Maximum depth is 0.10000000149. Gear/rack intrusion occurs before nominal entry, during the drive and after nominal release; the largest such depth is 0.07645140021. Closed tooth and guide solids are tested bidirectionally. The original spring is only used as the sample surface because its ends are uncapped; its targets are closed hardware solids. Co-rigid joins are excluded. These detections reject the baseline; this is not a continuous or complete all-pair certificate.

Rack return follows a prescribed cubic Hermite curve, not forces and mass. For example, at cycle coordinate 0.6 the displayed rack acceleration is +2.391253718 while the metadata reports downward spring force 0.476566194; no dynamic equation resolves that motion. The nominal spring stiffness does not determine the trajectory. The code also starts each drive instantly at rack speed 0.912318507 after a stationary dwell. A replacement must solve actual tooth contact, spring return, inertia and any explicitly assumed guide resistance or stop, with consistent entry, release and spring-seat geometry.

The baseline runner first treated the spring-guide group as a mesh and failed before producing measurements. Its [original runner and failure](081-first-baseline-probe-failure.json) remain archived. The corrected probe traverses the actual child meshes without changing model geometry. The initial attempt to crop using an unavailable Sharp package produced no file; ImageMagick extracted the unchanged source crop successfully.

All 850 verified production inputs remain unchanged. The [baseline checkpoint](081-baseline-checkpoint.json) preserves the original factory and test, exact probe and capture inputs, measured intrusions and all nine inspected images. Next: fit the source geometry, construct source-sized involute teeth and real guide passages, solve spring-driven return and finite tooth contact, then verify rendering and integrate after qualification.
`;
fs.writeFileSync(base+'081-reconstruction-notes.md',notes,{flag:'wx'});
const extra=['scripts/record-spring-rack-baseline.mjs','artifacts/reference/mm_081.html'],sources=extra.map((file,i)=>{
 const archive=base+'081-baseline-review-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(file)};
});
const files=fs.readdirSync(base).filter(n=>n.startsWith('081-')&&!n.endsWith('.png')&&n!=='081-baseline-checkpoint.json').map(n=>({file:base+n,sha256:hash(base+n)}));
const report={movement:81,status:'original-baseline-rejected',created:new Date().toISOString(),productionChanged:false,mechanicsPassed:false,
 frozenInputsMatched:Object.keys(frozen).length,views,sourceCropInspected:true,sourceMeasurementsFitted:false,
 surface:{poses:surface.poses,pairs:surface.pairs,checks:surface.checks,penetrations:surface.penetrations,maximumDepth:surface.maximumDepth,groups},
 sources,files,remaining:['Fit source circles, rack pitch, installed teeth and spring dimensions','Reconstruct compatible involute teeth and real guide passages',
 'Solve spring-driven return and finite tooth entry/release with explicit physical assumptions','Verify geometry, motion, source alignment and integrated playback'],full507GoalStillActive:true};
fs.writeFileSync(base+'081-baseline-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({status:report.status,views:views.length,groups,frozenInputs:report.frozenInputsMatched});
