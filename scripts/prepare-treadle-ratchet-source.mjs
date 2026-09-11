import fs from 'node:fs';
import crypto from 'node:crypto';
const file='artifacts/review/082-source-measurements.json',d=JSON.parse(fs.readFileSync(file)),
 hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),
 fit=d.fits.find(f=>f.teeth===26),source={
 center:d.circles.wheelFace.center,scale:d.circles.wheelFace.radius,
 circles:Object.fromEntries(Object.entries(d.circles).map(([name,c])=>[name,{center:c.center,radius:c.radius,rmsPixels:c.rmsResidual,visibleRays:c.readings.length}])),
 ratchet:{teeth:26,tipPhase:fit.phase*Math.PI/180,outerRadiusPixels:d.peaks.reduce((s,p)=>s+p.radius/d.peaks.length,0)-5.5,
  rootRadiusPixels:250.5,shortFaceFraction:.27,tipFitRmsPixels:fit.rmsPixels,
  direction:'Short face precedes the tip in increasing polar angle; both profiles and contact direction still require mechanical qualification.'},
 ...d.landmarks,
 assumptions:['Uniform 26-tooth divisions regularize the 22 visible/partly visible tips; four teeth are covered by the arms and pawls.',
 'The smooth face, shaft and ratchet outline are reconstructed concentrically despite small differences between the drawn circles.',
 'The end-on pulley spans source y=610..710. The longer vertical lines below it are the hanging strap and stand, not its rim. Its hidden depth follows a circular wheel.',
 'Rod and strap eye centers are separate from the pawl pivots. Link lengths and treadle attachment positions need not be equal.',
 'Tip and root radii approximate stroke centerlines, not the outer edge of the printing ink. Pawl outline readings remain a first geometry target.'],
 provenance:{file,sha256:hash(file),image:d.source,overlay:'artifacts/review/082-source-measurements.png'}};
fs.writeFileSync('scripts/lib/treadle-ratchet-source.mjs','// Measured reconstruction targets for movement 082; not a qualified mechanism.\nexport default '+JSON.stringify(source,null,2)+';\n');
console.log({teeth:source.ratchet.teeth,tipFitRmsPixels:fit.rmsPixels,pulleyToRatchetDiameter:(source.pulley.bottom-source.pulley.top)/(2*source.ratchet.outerRadiusPixels)});
