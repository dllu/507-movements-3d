import fs from 'node:fs';
import {createHash} from 'node:crypto';

// Manual center-line readings of visible ink strokes, in original 525px image.
// Arcs are deliberately not assigned to rigid parts: occlusion is ambiguous.
const traces = [
 {name:'left outer',points:[[181,208],[158,204],[132,209],[111,226],[97,248],[90,271],[94,297],[107,319],[128,335],[155,341],[180,334]]},
 {name:'right outer',points:[[210,217],[234,227],[253,246],[264,270],[260,293],[246,313],[224,327],[200,331],[180,326]]},
 {name:'right middle',points:[[188,223],[211,230],[234,249],[246,271],[243,293],[228,310],[209,320],[189,323],[173,317]]},
 {name:'right inner',points:[[172,229],[194,236],[215,253],[228,273],[223,294],[209,310],[190,317],[174,312]]},
 {name:'shaft-adjacent',points:[[158,233],[181,240],[200,255],[209,272],[204,292],[190,306],[171,312],[153,306]]},
];
function solve(matrix,rhs){
 const a=matrix.map((row,i)=>[...row,rhs[i]]);
 for(let i=0;i<rhs.length;i++){
  let pivot=i;for(let j=i+1;j<rhs.length;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
  [a[i],a[pivot]]=[a[pivot],a[i]];const d=a[i][i];
  for(let k=i;k<=rhs.length;k++)a[i][k]/=d;
  for(let j=0;j<rhs.length;j++)if(j!==i){const c=a[j][i];for(let k=i;k<=rhs.length;k++)a[j][k]-=c*a[i][k];}
 }
 return a.map(row=>row.at(-1));
}
function fit(points){
 const rows=points.map(([x,y])=>[x,y,1]),rhs=points.map(([x,y])=>-(x*x+y*y));
 const normal=[0,1,2].map(i=>[0,1,2].map(j=>rows.reduce((s,r)=>s+r[i]*r[j],0)));
 const [a,b,c]=solve(normal,[0,1,2].map(i=>rows.reduce((s,r,j)=>s+r[i]*rhs[j],0)));
 const center=[-a/2,-b/2],radius=Math.sqrt((a*a+b*b)/4-c);
 const residuals=points.map(([x,y])=>Math.hypot(x-center[0],y-center[1])-radius);
 return {center,radius,rmsPixels:Math.sqrt(residuals.reduce((s,r)=>s+r*r,0)/points.length),maxPixels:Math.max(...residuals.map(Math.abs))};
}
const arcs=traces.map(t=>({...t,circle:fit(t.points)}));
const report={movement:150,method:'Least-squares circle fits to manually read visible stroke center lines. About 2px reading uncertainty; circles are candidates, not established cam profiles. Distinct strokes may be faces or thickness edges of the same part. Hidden contours are not evidence.',arcs,sources:['public/engravings/mm_150.png','scripts/fit-selectable-cam-source-arcs.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/150-source-arcs.json',JSON.stringify(report,null,2)+'\n');
const colors=['#e63946','#0077b6','#8338ec','#00966c','#e98a00'];
const overlay=arcs.map((arc,i)=>{
 const {center:[x,y],radius}=arc.circle;
 return `<g fill="none" stroke="${colors[i]}" stroke-width="1"><circle cx="${x}" cy="${y}" r="${radius}" stroke-dasharray="4 3"/>${arc.points.map(([px,py])=>`<circle cx="${px}" cy="${py}" r="2"/>`).join('')}</g><text x="20" y="${395+i*20}" fill="${colors[i]}" font-size="13">${arc.name}: R=${radius.toFixed(1)}, RMS=${arc.circle.rmsPixels.toFixed(1)}px</text>`;
}).join('\n');
fs.writeFileSync('docs/validation/150-source-arcs.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="525" height="525" viewBox="0 0 525 525"><rect width="525" height="525" fill="white"/><image href="../../public/engravings/mm_150.png" width="525" height="525"/>${overlay}</svg>\n`);
console.log(arcs.map(a=>({name:a.name,...a.circle})));
