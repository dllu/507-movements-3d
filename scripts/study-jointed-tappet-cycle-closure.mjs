import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{spawnSync}from'node:child_process';
import{makeJointedTappetContactStudy,vadd,vsub,vrotate}from'./lib/jointed-tappet-contact-study.mjs';

const study=makeJointedTappetContactStudy({nosePixels:[800,711],seatHolding:true}),p=study.parameters,
  theta=p.wheelStart+p.pitch,readings=[];
for(let i=0;i<=2000;i++){
  const q=.35*i/2000,B=study.closeB(q,theta);readings.push({q,angle:B.angle,stop:B.stop,gap:B.gap});
}
const release=readings.find(r=>r.stop),atRest=study.closeB(0,theta),poses=[-1.85,-.57,-.3,0,.15,release.q].map(q=>({q,B:study.closeB(q,theta)})),
  report={movement:76,status:'candidate-cycle-does-not-close',productionChanged:false,cycleClosed:false,
    parameters:p,returnEnd:atRest,reset:release,readings,poses,
    source:{file:'scripts/lib/jointed-tappet-contact-study.mjs',sha256:createHash('sha256').update(await readFile('scripts/lib/jointed-tappet-contact-study.mjs')).digest('hex')},
    qualification:'The previous contact study had no individual contact-solver failures, but its assumed periodic rest configuration fails: the dog remains on the nearer exterior wheel branch at q=0 instead of returning to alpha=0. The extra positive tappet travel reported here is a geometric release threshold only. It neither supplies a physical return stop nor proves gravity dynamics, contact reactions, body clearance or source fidelity. The initial zero-angle dog placement belongs to a disconnected clear angular interval at the assumed rest pose.'};
await writeFile('artifacts/review/076-cycle-closure-diagnostic.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const curve=study.wheel.points.map(point=>vrotate(point,theta)),source=point=>[(point[0]-p.center[0])/p.scale,(p.center[1]-point[1])/p.scale],
  R=vsub(source([1282,589]),p.C),dogContour=[[800,711],[805,680],[944,645],[955,642],[993,629],[1035,665],
    [1009,708],[966,713],[974,742],[970,771],[953,794],[925,803],[890,799],[854,783],[832,763],[813,734]]
    .map(point=>vsub(source(point),p.PB));
const panels=poses.map(({q,B},i)=>{
  const left=(i%3)*400,top=Math.floor(i/3)*360,project=point=>[left+140+90*point[0],top+185-90*point[1]],
    path=points=>'M'+points.map(point=>project(point).join(',')).join('L')+'Z',circle=(point,r,color)=>{
      const[x,y]=project(point);return`<circle cx="${x}" cy="${y}" r="${r*90}" fill="${color}"/>`;},
    line=(a,b,color,width)=>{const[x1,y1]=project(a),[x2,y2]=project(b);return`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;},
    stopNose=study.noseAt(q),dog=dogContour.map(point=>vadd(B.pivot,vrotate(point,q+B.angle)));
  return`<rect x="${left}" y="${top}" width="400" height="360" fill="#faf8f1" stroke="#cbc9c1"/><text x="${left+12}" y="${top+25}" font-size="17" font-family="DejaVu Sans">q ${(q*180/Math.PI).toFixed(2)}°, dog ${(B.angle*180/Math.PI).toFixed(2)}°</text>`
    +`<path d="${path(curve)}" fill="#e6f1f7" stroke="#28677a" stroke-width="1.4"/>`
    +line(vadd(p.C,vrotate(p.B,q)),vadd(p.C,vrotate(R,q)),'#cba245',17)
    +`<path d="${path(dog)}" fill="#e1ba54" fill-opacity=".45" stroke="#a27015" stroke-width="1.3" stroke-dasharray="4 3"/>`
    +line(B.pivot,B.center,'#207b48',2)+line(B.pivot,stopNose,'#d05252',1)
    +circle(stopNose,p.noseRadius,'#d05252')+circle(B.center,p.noseRadius,'#207b48')+circle(p.C,.04,'#272b2e')+circle(B.pivot,.03,'#272b2e')
    +`<text x="${left+12}" y="${top+335}" font-size="13" font-family="DejaVu Sans">${B.stop?'Released to assumed stop':'First exterior contact blocks closing'}</text>`;
}).join('');
const prefix='artifacts/review/076-cycle-closure-diagnostic',svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760">${panels}<text x="12" y="745" font-size="15" font-family="DejaVu Sans">Green: contact-constrained nose. Red: assumed stop position. Dashed dog silhouette is provisional; no 3D clearance claim.</text></svg>`;
await writeFile(prefix+'.svg',svg,{flag:'wx'});const rendered=spawnSync('convert',['-background','white',prefix+'.svg',prefix+'.png']);
if(rendered.status!==0)throw new Error('Diagnostic plot render failed');
console.log({cycleClosed:false,returnDogAngle:atRest.angle,minimumResetQ:release.q,minimumResetDegrees:release.q*180/Math.PI});
