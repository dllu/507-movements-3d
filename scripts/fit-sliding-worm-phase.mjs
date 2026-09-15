import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source='public/engravings/mm_143.png';
const measured=JSON.parse(readFileSync('docs/validation/143-wheel-measurement.json'));
const {parameters:p,profile:c}=JSON.parse(readFileSync('/dev/shm/143-worm-candidate-profile.json'));
const n=c.angularSteps,pitch=2*Math.PI/p.teeth;
// Orthographic silhouette uses the largest radius at every axial station.
const radii=Array.from({length:n},(_,i)=>Math.max(...Array.from({length:c.axialSteps+1},(_,j)=>c.radii[j*(n+1)+i])));
const radius=angle=>{const t=((angle+pitch/2)/pitch%1+1)%1*n,i=Math.floor(t);return (radii[i]*(1-(t-i))+radii[(i+1)%n]*(t-i))/.015;};
let best={rms:Infinity};
for(let i=0;i<720;i++){
 const wheelPhase=Math.PI/2+i/720*pitch;
 // Raster outer edge is about one pixel beyond the nominal stroke center.
 const errors=measured.rows.map(r=>radius(-r.degrees*Math.PI/180-wheelPhase)-(r.radius-1));
 const rms=Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length);
 if(rms<best.rms)best={wheelPhase,wormPhase:-Math.PI/2+p.teeth*(wheelPhase-Math.PI/2),rms};
}
const points=Array.from({length:n*p.teeth},(_,i)=>{
 const local=-pitch/2+2*Math.PI*i/(n*p.teeth),angle=local+best.wheelPhase,r=radii[i%n]/.015;
 return [269.5+r*Math.cos(angle),338.75-r*Math.sin(angle)];
});
const png=readFileSync(source).toString('base64'),path=points.map((v,i)=>(i?'L':'M')+v.join(',')).join(' ')+'Z';
writeFileSync('docs/validation/143-generated-overlay.svg',`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 525 555"><image width="525" height="525" xlink:href="data:image/png;base64,${png}"/><path d="${path}" fill="none" stroke="#e45632" stroke-width=".65"/><text x="14" y="543" font-size="10">Candidate generated wheel silhouette; fitted on exposed lower arc.</text></svg>`);
writeFileSync('docs/validation/143-phase-fit.json',JSON.stringify({movement:143,...best,sourceSha256:createHash('sha256').update(readFileSync(source)).digest('hex'),profileSha256:createHash('sha256').update(JSON.stringify(c)).digest('hex'),method:'720 candidate phases over one tooth pitch; least squares radial error on the exposed 35–145 degree lower arc, with a one-pixel raster ink allowance. Other wheel regions are visually checked in the overlay, not part of this fit.'},null,2)+'\n');
console.log(best);
