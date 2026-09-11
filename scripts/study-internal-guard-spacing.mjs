import{readFile,writeFile}from'node:fs/promises';
import{makeInternalGuardStudy}from'./lib/internal-guard-study.mjs';
import{projectOpenRimTappet}from'./lib/open-rim-tappet-study.mjs';
const source=JSON.parse(await readFile('artifacts/review/071-source-layout-study.json','utf8'));
const scale=source.output.radius/1.28,base=makeInternalGuardStudy(source).parameters;
const angle=p=>Math.atan2(source.driverOuter.center[1]-p[1],p[0]-source.driverOuter.center[0])-base.inputAngle;
const sourceOpenings=[{inner:[[731,424],[621,529]].map(angle),outer:[[600,436],[526,561]].map(angle)},
  {inner:[[648,931],[735,1006]].map(angle),outer:[[553,930],[680,1060]].map(angle)}];
// Unwrap each range around its first endpoint, then put its angles in increasing order.
for(const cut of sourceOpenings)for(const name of ['inner','outer']){
  const a=cut[name][0];cut[name]=cut[name].map(b=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))).sort((a,b)=>a-b);
}
const trials=[];
for(const centerDistance of [1.56,1.60,source.centerDistance/scale,1.65,1.68,base.centerDistance]){
  for(const shape of ['radial','traced-oblique'])for(const shift of [0,-.15,-.3]){
    const obliqueOpenings=shape==='traced-oblique'?sourceOpenings.map((cut,i)=>Object.fromEntries(Object.entries(cut).map(([key,values])=>[key,values.map(v=>v+(i===0?shift:0))]))):undefined;
    const study=makeInternalGuardStudy(source,{centerDistance,upperCenter:-.4+shift,obliqueOpenings,
      ...(shape==='traced-oblique'?{rimOuter:source.driverOuter.radius/scale}: {})});
    const result=projectOpenRimTappet(study,{steps:1040,begin:1.8,end:5.4});
    const summary={shape,shift,centerDistance,spacingErrorPixels:(centerDistance-source.centerDistance/scale)*scale,
      innerRadiusErrorPixels:(study.parameters.rimInner-base.rimInner)*scale,poses:result.poses,advance:result.actualAdvance,
      peak:result.maximumSpeed,failure:result.failed[0]?.reason};
    trials.push({...summary,...result});console.log(summary);
  }
}
await writeFile('artifacts/review/071-spacing-notch-trials.json',JSON.stringify({movement:71,status:'isolated-spacing-and-notch-trials',
  productionChanged:false,sourceOpenings,method:'The source dotted circle seats the extreme two of three interior studs. Vary shaft spacing with the corresponding exact seating radius, then test radial and manually read oblique notches. The oblique source corners are approximate readings and the complete solid outer rim is represented. Neither source fidelity nor physical acceptance is implied by completion of a projected path.',trials},null,2)+'\n',{flag:'wx'});
