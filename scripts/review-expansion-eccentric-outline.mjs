import fs from 'node:fs';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
import { expansionEccentricOutline as trace } from '../src/data/expansion-eccentric-outline.js';
const points = trace.visibleRuns.flat();
const movement = JSON.parse(fs.readFileSync('src/data/movements.json')).movements[136];
const model = createMovementModel(movement);
const geometry = model.root.userData.geometry;
const modelCircle = {center: [geometry.sourceCamCenterX, geometry.sourceCamCenterY], radius: geometry.camRadius / geometry.sourceScale};
disposeObject3D(model.root);
// Algebraic least-squares circle fit, independent of the current model's radius.
const matrix = Array.from({length:3},()=>[0,0,0,0]);
for(const [x,y] of points){const v=[x,y,1],z=-(x*x+y*y);for(let i=0;i<3;i++){for(let j=0;j<3;j++)matrix[i][j]+=v[i]*v[j];matrix[i][3]+=v[i]*z;}}
for(let i=0;i<3;i++){
 let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(matrix[j][i])>Math.abs(matrix[pivot][i]))pivot=j;
 [matrix[i],matrix[pivot]]=[matrix[pivot],matrix[i]];
 const divisor=matrix[i][i];for(let j=i;j<4;j++)matrix[i][j]/=divisor;
 for(let k=0;k<3;k++)if(k!==i){const factor=matrix[k][i];for(let j=i;j<4;j++)matrix[k][j]-=factor*matrix[i][j];}
}
const [a,b,c]=matrix.map(row=>row[3]),center=[-a/2,-b/2],radius=Math.sqrt((a*a+b*b)/4-c);
const errors=(center,radius)=>points.map(([x,y])=>Math.hypot(x-center[0],y-center[1])-radius);
const summarize=values=>({rmsPixels:Math.sqrt(values.reduce((sum,v)=>sum+v*v,0)/values.length),maximumAbsolutePixels:Math.max(...values.map(Math.abs))});
const report={landmarks:points.length,source:'public/engravings/mm_137.png',currentCircle:{...modelCircle,...summarize(errors(modelCircle.center,modelCircle.radius))},fittedCircle:{center,radius,...summarize(errors(center,radius))},status:'The circular-cam assumption fails visible-edge agreement; hidden edges and roller capture remain unresolved.'};
fs.writeFileSync('docs/validation/137-outline-review.json',JSON.stringify(report,null,2)+'\n');
const engraving=fs.readFileSync(report.source).toString('base64');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="600" viewBox="0 0 750 600"><rect width="750" height="600" fill="white"/><image href="data:image/png;base64,${engraving}" width="525" height="525"/><circle cx="${modelCircle.center[0]}" cy="${modelCircle.center[1]}" r="${modelCircle.radius}" fill="none" stroke="#d64b19" stroke-width="2"/><circle cx="${center[0]}" cy="${center[1]}" r="${radius}" fill="none" stroke="#3574bd" stroke-width="1.5" stroke-dasharray="5 4"/>${points.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.5" fill="#13834d"/>`).join('')}<g font-family="sans-serif" font-size="14"><text x="535" y="80" fill="#d64b19">Current model circle</text><text x="535" y="105" fill="#3574bd">Fitted circle</text><text x="535" y="130" fill="#13834d">Visible-edge landmarks</text><text x="20" y="552">137 — visible contour review; hidden arcs are not measured.</text><text x="20" y="580">Current max error: ${report.currentCircle.maximumAbsolutePixels.toFixed(2)} px; fitted max: ${report.fittedCircle.maximumAbsolutePixels.toFixed(2)} px.</text></g></svg>`;
fs.writeFileSync('docs/validation/137-outline-review.svg',svg);
console.log(report);
