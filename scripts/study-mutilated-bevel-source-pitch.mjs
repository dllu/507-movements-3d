import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const source='artifacts/reference/brown-074-detail.png';
const observations={
  gearA:{coordinate:'y',heelCoordinate:248,center:494,radius:311.5,centers:[353.5,407.5,462,522.5,588,647,694.5]},
  driverC:{coordinate:'x',heelCoordinate:808,center:652.5,radius:399.5,centers:[655.8,729.9,795.1,860.2,913.9,957.3,996.9,1032.7]},
};
function fit(row,count){
  let best=null;
  for(let step=0;step<=20000;step++){
    const phase=-Math.PI/2+Math.PI*step/20000,predicted=row.centers.map((_,i)=>row.center+row.radius*Math.sin(phase+i*2*Math.PI/count));
    const errors=predicted.map((v,i)=>v-row.centers[i]),rms=Math.sqrt(errors.reduce((s,v)=>s+v*v,0)/errors.length);
    if(!best||rms<best.rms)best={count,phase,predicted,errors,rms,maximumError:Math.max(...errors.map(Math.abs))};
  }
  return best;
}
const fits=Object.fromEntries(Object.entries(observations).map(([name,row])=>[name,Array.from({length:13},(_,i)=>fit(row,24+i*2)).sort((a,b)=>a.rms-b.rms)]));
const report={movement:74,status:'source-pitch-diagnostic',source,sha256:createHash('sha256').update(await readFile(source)).digest('hex'),observations,fits,
  measuredRadiusRatio:observations.driverC.radius/observations.gearA.radius,candidateCounts:{gearA:32,driverC:40},
  qualification:'Hand-picked centers of visible heel face caps, in original scan pixels. Fixed centers and radii come from the shafts and outer rim extents. Equal angular pitch is fitted under the orthographic reconstruction assumption. Ink width, perspective, tooth relief and drafting distortion limit these observations; these are not authoritative full tooth counts. The visible local pitch and global rim proportions are checked separately because the engraving does not uniquely establish a mechanically consistent pair of counts.'};
await writeFile('artifacts/review/074-source-pitch-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const markers=Object.entries(observations).flatMap(([name,row])=>row.centers.map((value,i)=>{
  const x=row.coordinate==='x'?value:row.heelCoordinate,y=row.coordinate==='y'?value:row.heelCoordinate;
  return `<circle cx="${x}" cy="${y}" r="4" fill="${name==='gearA'?'#00ffff':'#ff40ff'}"/><text x="${x+8}" y="${y-8}" font-size="13" fill="${name==='gearA'?'#00ffff':'#ff40ff'}">${name==='gearA'?'A':'C'}${i}</text>`;
})).join('\n');
await writeFile('artifacts/review/074-source-pitch-markers.svg',`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1320 1370"><image width="1320" height="1370" xlink:href="data:image/png;base64,${(await readFile(source)).toString('base64')}"/>${markers}</svg>\n`,{flag:'wx'});
console.log({measuredRadiusRatio:report.measuredRadiusRatio,bestFits:Object.fromEntries(Object.entries(fits).map(([name,rows])=>[name,rows.slice(0,3).map(({count,rms,maximumError})=>({count,rms,maximumError}))]))});
