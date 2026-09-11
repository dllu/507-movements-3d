import {readFile,writeFile}from'node:fs/promises';
import{createMovementModel}from'../src/simulation/registry.js';
import{setSpin}from'../src/simulation/primitives.js';
import{prepareBevelSurfaces,sampleBevelPair}from'./lib/bevel-working-surfaces.mjs';

const catalog=JSON.parse(await readFile('src/data/movements.json','utf8')),model=createMovementModel(catalog.movements[73]);
const{blocks:b,geometry:p}=model.root.userData,A=prepareBevelSurfaces(b.gearA),C=prepareBevelSurfaces(b.driverC),rows=[];
const progress=(u,start)=>{const value=u-start,cycle=Math.floor(value),phase=value-cycle;return Math.PI*cycle+2*Math.PI*Math.min(.5,phase);};
for(const shiftTeeth of [0,.2,.4,.5,.6,.8,1]){
  const shift=shiftTeeth/p.teeth,poses=[];let checks=0,inside=0,minimumGap=.08;
  // Two complete tooth pitches on either side of entry and exit, plus an
  // interior working pitch. The opposing pair is geometrically symmetric.
  const coordinates=[...Array.from({length:65},(_,i)=>.5+(i/64*4-2)/p.teeth),
    ...Array.from({length:65},(_,i)=>1+(i/64*4-2)/p.teeth),
    ...Array.from({length:25},(_,i)=>.7+i/24/p.teeth)];
  for(const coordinate of coordinates){
    const angleA=p.outputBasePhaseA-2*Math.PI*shift+progress(coordinate,.5-shift);
    setSpin(b.driverC,p.driverBasePhase-2*Math.PI*coordinate);setSpin(b.gearA,angleA);model.root.updateMatrixWorld(true);
    const a=sampleBevelPair(A,C),c=sampleBevelPair(C,A),gap=Math.min(a.gap,c.gap);
    checks+=a.checks+c.checks;inside+=a.inside+c.inside;minimumGap=Math.min(minimumGap,gap);
    poses.push({coordinate,angleA,gap,inside:a.inside+c.inside,witness:a.gap<c.gap?a.witness:c.witness});
  }
  const row={shiftTeeth,checks,inside,minimumGap,poses};rows.push(row);console.log({shiftTeeth,checks,inside,minimumGap});
}
await writeFile('artifacts/review/074-timing-offset-study.json',JSON.stringify({movement:74,status:'isolated-timing-diagnosis',productionChanged:false,rows,
  qualification:'Rephases the ideal half-turn motion on an in-memory copy of the existing gear solids. Complete entry/exit neighborhoods and one interior pitch are checked in both directions for A/C. B/C is symmetric. Positive sampled gaps are not proof of contact; this diagnoses whether a timing shift alone can remove the original intersections.'},null,2)+'\n',{flag:'wx'});
