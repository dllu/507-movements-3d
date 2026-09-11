import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {circleFit} from './lib/source-circle-fit.mjs';

const file='artifacts/reference/brown-076-detail.png',width=1425,height=1320,
  decoded=spawnSync('convert',[file,'-depth','8','rgb:-'],{maxBuffer:8*1024*1024});
if(decoded.status!==0||decoded.stdout.length!==width*height*3)throw new Error('Source decode failed');
const dark=(x,y)=>x>=0&&x<width&&y>=0&&y<height&&decoded.stdout[3*(width*Math.round(y)+Math.round(x))]<100;
const readArc=(center,radius,rows,band=24)=>{
  const points=[],missing=[];
  for(const y of rows){
    const expected=center[0]+Math.sqrt(radius**2-(y-center[1])**2),runs=[];let first=null;
    for(let x=Math.floor(expected-band);x<=Math.ceil(expected+band);x++){
      if(dark(x,y)){if(first===null)first=x;}
      else if(first!==null){runs.push([(first+x-1)/2,y]);first=null;}
    }
    runs.sort((a,b)=>Math.abs(a[0]-expected)-Math.abs(b[0]-expected));
    if(runs.length)points.push(runs[0]);else missing.push(y);
  }
  return{...circleFit(points),missing};
};
const readCircle=(center,low,high)=>{
  const points=[],missing=[];
  for(let degree=0;degree<360;degree+=10){
    const angle=degree*Math.PI/180;let first=null,last=null;
    for(let r=low;r<=high;r+=.25){
      if(dark(center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle))){if(first===null)first=r;}
      else if(first!==null){last=r-.25;break;}
    }
    if(first===null||last===null){missing.push(degree);continue;}
    const r=(first+last)/2;points.push([center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle)]);
  }
  return{...circleFit(points),missing};
};
const outer=readArc([550,625],806,Array.from({length:40},(_,i)=>250+20*i)),
  inner=readArc([550,625],636,[450,470,490,510,530,...Array.from({length:17},(_,i)=>715+20*i)]),
  hub=readCircle([431,592],65,87),
  pivots={fixedC:[1125,637],joint:[994,671],holding:[271,168],studD:[1187,358]},
  report={movement:76,status:'initial-source-circle-study',productionChanged:false,
    source:{file,width,height,crop:[3070,3860,width,height],page:'artifacts/reference/brown-page-26-6000.png',
      sha256:createHash('sha256').update(await readFile(file)).digest('hex')},outer,inner,hub,pivots,
    qualification:'Dark-stroke samples on the visible right-hand outer and inner rim arcs; separate circle fits, not an assumption of concentricity. Hub samples use its closed outer circle. Pivot and stud positions are provisional manual readings. Source tooth count and the complete stud/tappet contact are not yet established.'};
await writeFile('artifacts/review/076-source-circle-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const colors=['#008cff','#e941b5','#ffe529'],circles=[outer,inner,hub],
  svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" xlink:href="data:image/png;base64,${(await readFile(file)).toString('base64')}"/>`
  +circles.map((r,i)=>`<circle cx="${r.center[0]}" cy="${r.center[1]}" r="${r.radius}" fill="none" stroke="${colors[i]}" stroke-width="2"/>`
    +r.points.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${colors[i]}"/>`).join('')
    +`<path d="M${r.center[0]-8},${r.center[1]}h16M${r.center[0]},${r.center[1]-8}v16" stroke="${colors[i]}" stroke-width="2"/>`).join('')
  +Object.entries(pivots).map(([name,p])=>`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#00ddff"/><text x="${p[0]+8}" y="${p[1]-8}" font-size="22" fill="#00ddff">${name}</text>`).join('')+'</svg>';
await writeFile('artifacts/review/076-source-circle-study.svg',svg,{flag:'wx'});
const rendered=spawnSync('convert',['-background','white','artifacts/review/076-source-circle-study.svg','artifacts/review/076-source-circle-study.png']);
if(rendered.status!==0)throw new Error('Source plot render failed');
console.log(Object.fromEntries(Object.entries({outer,inner,hub}).map(([name,r])=>[name,{center:r.center,radius:r.radius,rms:r.rmsResidual,maximum:r.maximumResidual,missing:r.missing}])));
