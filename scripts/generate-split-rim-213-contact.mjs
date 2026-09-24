// Finite square-tooth profile + retained clockwise contact branch; no dynamic force claim.
// Rebuild with: node scripts/generate-split-rim-213-contact.mjs [--check]
import {readFile,writeFile} from 'node:fs/promises';
import {createAuthoredIntermittentMovement as create} from '../src/simulation/authored-intermittent.js';
import {nearest390Outline} from '../src/simulation/dual-band-pawl-contact.js';
import {poly,polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
const model=create({id:213}),g=model.root.userData.geometry,TAU=2*Math.PI,pitch=g.stopPitchAngle,r=g.facePinRadius;
// Inputs are source dimensions. Keep the reference phase independent of a
// regenerated output so --check never depends on the previous bake.
const referenceInitial=(2+g.sourceIndexProgress)*pitch;
const mid=(g.freeApproachInputAngle+TAU)/2,steps=4096,allowance=.0002;
// Brown draws square teeth: flat tops, parallel-sided gaps and a flat root,
// with the pin (radius 7.8 source px) dipping only a little below the tips.
// The tops sit below the pin's closest approach (1.897), so the pin drives on
// the square top corners and its approach path clears the neighbouring tops.
// The root is free clearance; its depth (0.29) follows Brown's ~16 px teeth.
const toothTop=1.84,toothRoot=1.55;
const pin=u=>[Math.cos(g.facePinMountPhase+u)*g.facePinOrbitRadius,Math.sin(g.facePinMountPhase+u)*g.facePinOrbitRadius-g.centerDistance];
const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Trial law: a Geneva index. While the pin's bearing from the stop axis is
// within half a pitch of the line of centres, the wheel turns with it, so the
// pin runs straight in and out along a radial gap; otherwise the wheel rests.
const trial=u=>{const phase=((u%TAU)+TAU)%TAU;if(Math.abs(phase-mid)>Math.PI/2)return referenceInitial-(phase>mid?pitch:0);
 const s=wrap(Math.atan2(...pin(u).slice().reverse())+Math.PI/2),p=Math.max(0,Math.min(1,(pitch/2-s)/pitch));return referenceInitial-pitch*p;};
// One gap in the wheel frame: a parallel-sided slot from the root out past
// the tops, as wide as the pin's chord at the tops (the Geneva law keeps the
// pin on its centre line). Any part of the pin's path over the resting wheel
// that reaches the tops cuts them from outside, which a radial profile
// represents exactly; with these tops that relief is empty.
const gapCenter=Math.atan2(...rotate(pin(mid),-trial(mid)).slice().reverse());
// The gap is sized so the pin at its closest approach just meets both
// rounded top corners (fillet radius below), keeping the index free of play.
const cornerFillet=.008,closest=g.centerDistance-g.facePinOrbitRadius,filletGap=h=>{const t=Math.sqrt((toothTop-cornerFillet)**2-(h+cornerFillet)**2);return Math.hypot(closest-t,h+cornerFillet)-cornerFillet-r;};
let slotHalf=0;{let low=0,high=r;for(let i=0;i<80;i++){const m=(low+high)/2;if(filletGap(m)<allowance)low=m;else high=m;}slotHalf=high;}
const inSlotBand=c=>{const a=Math.atan2(c[1],c[0]),k=Math.round((a-gapCenter)/pitch),b=gapCenter+k*pitch;return Math.abs(-c[0]*Math.sin(b)+c[1]*Math.cos(b))<slotHalf+1e-9&&c[0]*Math.cos(b)+c[1]*Math.sin(b)>0;};
const slotRegion=(b,widen=0)=>{const along=[Math.cos(b),Math.sin(b)],across=[-along[1],along[0]],half=slotHalf+widen,at=(radius,side)=>[radius*along[0]+side*half*across[0],radius*along[1]+side*half*across[1]];return poly([at(toothRoot,-1),at(g.stopOuterRadius+.5,-1),at(g.stopOuterRadius+.5,1),at(toothRoot,1)]);};
// Radial cut by pin circles (material is r < R(angle)); pins inside a slot
// band below the tops are already inside the slot and are skipped.
const radialCut=(radiusAt,angle,centers)=>{let value=radiusAt;for(const c of centers){const delta=angle-c.angle,side=c.rho*Math.sin(delta),projection=c.rho*Math.cos(delta);if(projection>0&&Math.abs(side)<c.radius)value=Math.min(value,projection-Math.sqrt(c.radius*c.radius-side*side));}return value;};
const trialCenters=[];for(let i=0;i<=4096;i++){const u=mid-Math.PI/2+Math.PI*i/4096,c=rotate(pin(u),-trial(u)),rho=Math.hypot(...c);if(rho>toothTop+r+.001)continue;if(inSlotBand(c)&&rho<toothTop)continue;trialCenters.push({rho,angle:Math.atan2(c[1],c[0]),radius:r+allowance});}
const n=1024,periodicRadii=Array.from({length:n},(_,i)=>{const a=gapCenter+pitch*i/n;let value=toothTop;for(let k=-1;k<=1;k++)value=Math.min(value,radialCut(toothTop,a,trialCenters.map(c=>({...c,angle:c.angle+k*pitch}))));return value;});
const radiusAtPeriodic=a=>{const x=(((a-gapCenter)%pitch)+pitch)%pitch/pitch*n,i=Math.floor(x),t=x-i;return periodicRadii[i%n]*(1-t)+periodicRadii[(i+1)%n]*t;};
// Each tooth's top corners are rounded with a small fillet, so the pin always
// bears on a smooth face; at the view scale the teeth still read square.
const cornerPieces=(b,keep=()=>true,widen=0)=>[-1,1].flatMap(side=>{const slotHalfHere=slotHalf+widen;
 const along=[Math.cos(b),Math.sin(b)],across=[-along[1],along[0]],offset=side*(slotHalfHere+cornerFillet),t=Math.sqrt((toothTop-cornerFillet)**2-offset**2),center=[t*along[0]+offset*across[0],t*along[1]+offset*across[1]];
 const tWall=Math.sqrt(toothTop**2-(side*slotHalfHere)**2),corner=[tWall*along[0]+side*slotHalfHere*across[0],tWall*along[1]+side*slotHalfHere*across[1]],wall=[t*along[0]+side*slotHalfHere*across[0],t*along[1]+side*slotHalfHere*across[1]];
 const topPoint=[center[0]*toothTop/(toothTop-cornerFillet),center[1]*toothTop/(toothTop-cornerFillet)];if(!keep(Math.atan2(topPoint[1],topPoint[0])))return[];
 const a0=Math.atan2(topPoint[1]-center[1],topPoint[0]-center[0]),a1=Math.atan2(wall[1]-center[1],wall[0]-center[0]);let sweep=a1-a0;while(sweep>Math.PI)sweep-=TAU;while(sweep<-Math.PI)sweep+=TAU;
 const arc=Array.from({length:65},(_,i)=>[center[0]+cornerFillet*Math.cos(a0+sweep*i/64),center[1]+cornerFillet*Math.sin(a0+sweep*i/64)]);
 const outward=[corner[0]+(corner[0]-center[0])*2,corner[1]+(corner[1]-center[1])*2];
 return[poly([...arc,outward])];});
const periodicRegion=clip.difference(poly(Array.from({length:22*n},(_,i)=>{const a=TAU*i/(22*n),radius=radiusAtPeriodic(a);return[radius*Math.cos(a),radius*Math.sin(a)];})),...Array.from({length:22},(_,k)=>slotRegion(gapCenter+k*pitch)),...Array.from({length:22},(_,k)=>cornerPieces(gapCenter+k*pitch)).flat());
const periodicOutline=periodicRegion[0][0].slice(0,-1);
function gap(u,q){const p=pin(u),rho=Math.hypot(...p),phi=Math.atan2(p[1],p[0])-q,a=gapCenter+((phi-gapCenter+pitch/2)%pitch+pitch)%pitch-pitch/2;return nearest390Outline([rho*Math.cos(a),rho*Math.sin(a)],periodicOutline).distance-r;}
function solveTurn(initial){let q=initial;const angles=[];for(let i=0;i<=steps;i++){
 const u=TAU*i/steps;
 if(gap(u,q)<0){let low=q,found=false;for(let j=1;j<=400;j++){low=q-j*.00005;if(gap(u,low)>=0){found=true;break;}}if(!found)throw Error(`213 disconnected branch at ${u}`);
  let high=q;for(let j=0;j<36;j++){const a=(low+high)/2;if(gap(u,a)>=0)low=a;else high=a;}if(q-low>.02)throw Error('213 branch jump');q=low;}
 angles.push(q);
 }return angles;}
let angles=solveTurn(referenceInitial);const initialAngle=angles.at(-1)+pitch;angles=solveTurn(initialAngle);
if(Math.abs(initialAngle-angles.at(-1)-pitch)>1e-9)throw Error('213 contact branch does not index one pitch');
function solveReverse(initial){let q=initial;const result=Array(steps+1);for(let i=steps;i>=0;i--){
 const u=TAU*i/steps;
 if(gap(u,q)<0){let high=q,found=false;for(let j=1;j<=400;j++){high=q+j*.00005;if(gap(u,high)>=0){found=true;break;}}if(!found)throw Error(`213 reverse disconnected at ${u}`);
 let low=q;for(let j=0;j<36;j++){const a=(low+high)/2;if(gap(u,a)>=0)high=a;else low=a;}if(high-q>.02)throw Error('213 reverse branch jump');q=high;}
 result[i]=q;
 }return result;}
const reverseAngles=solveReverse(initialAngle-pitch);
const firstAngles=solveTurn(reverseAngles[0]);
const repeatReverseAngles=solveReverse(reverseAngles[0]-pitch);
// The five-tooth sector is the periodic profile between tooth centres; the
// rest of the ring is uncut rim. The full five-index sweep of the actual
// retained paths then rounds the two terminal shoulders. Its allowance tapers
// to zero at both winding limits to preserve the finite terminal contacts.
const start=Math.PI/2+g.splitHalfAngle,end=Math.PI/2+TAU-g.splitHalfAngle;
const inSector=a=>{const x=(((a-g.stopSectorStartAngle)%TAU)+TAU)%TAU;return x<=g.stopSectorEndAngle-g.stopSectorStartAngle;};
const pathCenters=[];
for(const reverse of[false,true])for(let i=0;i<=Math.ceil(g.forwardInputLimit/TAU*steps);i++){
 const u=Math.min(g.forwardInputLimit,TAU*i/steps),turn=Math.min(5,Math.floor(u/TAU)),phase=u-turn*TAU,index=Math.min(steps,Math.round(phase/TAU*steps));
 const q=turn===5?initialAngle-5*pitch:(reverse?(turn===4?reverseAngles:repeatReverseAngles):(turn===0?firstAngles:angles))[index]-turn*pitch;
 const c=rotate(pin(u),-q),rho=Math.hypot(...c);if(rho>g.stopOuterRadius+r+.001)continue;
 if(inSlotBand(c)&&rho<toothTop&&inSector(Math.atan2(c[1],c[0])))continue;
 pathCenters.push({rho,angle:Math.atan2(c[1],c[0]),radius:r+allowance*Math.min(1,u/.01,(g.forwardInputLimit-u)/.01)**2});}
// The teeth are exactly the periodic profile the paths were solved on, so
// only the uncut rim (the terminal shoulders) takes the path cut.
// The shoulders at the sector ends are exact radial steps: both radii are
// placed at the boundary angle so no chord crosses the corner.
const rimRadius=a=>radialCut(g.stopOuterRadius,a,pathCenters.map(c=>({...c,angle:c.angle+TAU*Math.round((a-c.angle)/TAU)})));
const outerAngles=Array.from({length:8193},(_,i)=>start+(end-start)*i/8192);
for(const boundary of[g.stopSectorStartAngle,g.stopSectorEndAngle]){const a=boundary+TAU*Math.ceil((start-boundary)/TAU);outerAngles.push(a,a);}
outerAngles.sort((a,b)=>a-b);
const outerPoints=[];for(let i=0;i<outerAngles.length;i++){const a=outerAngles[i];let radius;
 if(i>0&&a===outerAngles[i-1])continue;
 if(i+1<outerAngles.length&&a===outerAngles[i+1]){const before=inSector(a-1e-9),rim=rimRadius(a),teeth=Math.min(g.stopOuterRadius,radiusAtPeriodic(a));for(const value of before?[teeth,rim]:[rim,teeth])outerPoints.push([value*Math.cos(a),value*Math.sin(a)]);continue;}
 radius=inSector(a)?Math.min(g.stopOuterRadius,radiusAtPeriodic(a)):rimRadius(a);outerPoints.push([radius*Math.cos(a),radius*Math.sin(a)]);}
const ringPolygon=poly([...outerPoints,...Array.from({length:151},(_,i)=>{const a=end-(end-start)*i/150;return[g.stopInnerRadius*Math.cos(a),g.stopInnerRadius*Math.sin(a)];})]);
const sectorSlots=Array.from({length:22},(_,k)=>gapCenter+k*pitch).filter(b=>inSector(b));
if(sectorSlots.length!==6)throw Error(`213 expects six sector gaps, found ${sectorSlots.length}`);
// The rendered gaps are .0006 wider than the solved ones, so the sampled
// playback (which rounds each sudden pickup) never leads the pin into a face.
const renderWiden=.0006;
let region=clip.difference(ringPolygon,...sectorSlots.map(b=>slotRegion(b,renderWiden)),...sectorSlots.flatMap(b=>cornerPieces(b,inSector,renderWiden)));
if(region.length!==1||region[0].length!==1)throw Error('213 stop ring is not one simply connected plate');
// Re-order the ring as the old outline: the outer edge from the split's start
// to its end, then the 151-point inner arc back.
let ring=region[0][0].slice(0,-1);const area=ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1];},0);if(area<0)ring.reverse();
const near=(p,a,radius)=>Math.hypot(p[0]-radius*Math.cos(a),p[1]-radius*Math.sin(a))<1e-9;
const first=ring.findIndex(p=>near(p,start,g.stopOuterRadius));ring=[...ring.slice(first),...ring.slice(0,first)];
const last=ring.findIndex(p=>near(p,end,g.stopOuterRadius));if(first<0||last<0)throw Error('213 split corners not found');
const outer=ring.slice(0,last+1),inner=Array.from({length:151},(_,i)=>{const a=end-(end-start)*i/150;return[g.stopInnerRadius*Math.cos(a),g.stopInnerRadius*Math.sin(a)];});
const outline=[...outer,...inner];
const data={initialAngle,angles,firstAngles,reverseAngles,repeatReverseAngles,outline,outer,regularRadiusRange:[toothRoot,toothTop],allowance,steps,trialLaw:'geneva'};
const output='// Generated by scripts/generate-split-rim-213-contact.mjs.\nexport const splitRim213Contact = '+JSON.stringify(data)+';\n';
const target=new URL('../src/simulation/baked/split-rim-213-contact.js',import.meta.url);
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==output)throw Error('213 bake differs');console.log('213 bake is byte-identical');}else{await writeFile(target,output);console.log({initialAngle,advance:initialAngle-angles.at(-1),regularRadiusRange:data.regularRadiusRange,points:outline.length,pathCenters:pathCenters.length});}
