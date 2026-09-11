import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { makeOpenRimTappetCandidate } from './lib/open-rim-tappet-candidate.mjs';
import { extrudedPlateContour } from './lib/extruded-plate-contour.mjs';
const layout=JSON.parse(await readFile('artifacts/review/070-source-layout-study.json','utf8'));
const model=makeOpenRimTappetCandidate(),{parts,geometry:p}=model.root.userData;
model.update(0);model.root.updateMatrixWorld(true);
const anchor=layout.output.center.map((v,i)=>(v+layout.driver.center[i])/2),scale=p.scale;
const project=point=>[anchor[0]+scale*point.x,anchor[1]-scale*point.y];
const contour=mesh=>extrudedPlateContour(mesh.geometry).map(point=>project(new THREE.Vector3(...point,0).applyMatrix4(mesh.matrixWorld)));
const contours=Object.fromEntries(Object.entries(parts).map(([name,mesh])=>[name,contour(mesh)]));
const nearest=(q,path)=>path.reduce((best,a,i)=>{
  const b=path[(i+1)%path.length],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/den)):0;
  const point=[a[0]+t*dx,a[1]+t*dy],distance=Math.hypot(q[0]-point[0],q[1]-point[1]);
  return distance<best.distance?{point,distance}:best;
},{distance:Infinity});
const groups=[['outputCircle',layout.output.points,contours.outputPlate],
  ['driverCircle',layout.driver.points,contours.driverCover],['rimInnerEdge',layout.rim.points,contours.rim],
  ['tappetCorners',[[1018,714],[686,710],[692,749],[1028,812]],contours.tappet]]
  .map(([name,points,path])=>({name,rows:points.map(point=>({point,nearest:nearest(point,path)}))}));
const pinOrder=[5,4,3,2,1,0,9,8,7,6];
groups.push({name:'studCenters',rows:layout.studOrbit.points.map((point,i)=>{
  const stud=pinOrder[i],at=project(new THREE.Vector3().applyMatrix4(parts[`stud${stud}`].matrixWorld));
  return{point,stud,nearest:{point:at,distance:Math.hypot(point[0]-at[0],point[1]-at[1])}};
})});
for(const group of groups){group.samples=group.rows.length;group.maximumResidual=Math.max(...group.rows.map(r=>r.nearest.distance));
  group.rmsResidual=Math.sqrt(group.rows.reduce((sum,r)=>sum+r.nearest.distance**2,0)/group.samples);}
const sourcePath='artifacts/reference/brown-070-detail.png',source=await readFile(sourcePath);
const report={movement:70,status:'isolated-actual-mesh-source-fit',productionChanged:false,
  method:'Actual Float32 mesh boundaries and transformed stud centers at the source-traced input angle. One shared orthographic scale, translation and assembly angle; no per-part fitting or output phase adjustment. Every original circle, dashed rim and stud reading is retained. Traced tappet corners informed the candidate. Brown stud angular spacing is visibly irregular, so the regular ten-stud pattern cannot match every center exactly.',
  source:{file:sourcePath,sha256:createHash('sha256').update(source).digest('hex')},anchor,scale,
  assemblyAngle:p.assemblyAngle,inputAngle:p.initialInputPhase,outputAngle:model.motion.atTime(0).outputAngle,
  adjustments:{centerDistancePixels:p.centerDistance*scale-layout.centerDistance,tappetTipShorteningPixels:p.shortening*scale},
  samples:groups.reduce((sum,g)=>sum+g.samples,0),groups};
await writeFile('artifacts/review/070-refined-source-fit.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const line=(ring,color,dashed=false)=>`<polyline points="${[...ring,ring[0]].map(q=>q.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2"${dashed?' stroke-dasharray="6 4"':''}/>`;
const outlines=Object.entries(contours).map(([name,path])=>line(path,name.startsWith('driver')||name==='rim'?'#ed0057':name==='tappet'?'#059732':'#0087ff',name==='rim'||name==='tappet'||name==='stud0')).join('');
const marks=groups.flatMap(g=>g.rows.map(r=>`<circle cx="${r.point[0]}" cy="${r.point[1]}" r="3" fill="none" stroke="#111" stroke-width="1"/><line x1="${r.point[0]}" y1="${r.point[1]}" x2="${r.nearest.point[0]}" y2="${r.nearest.point[1]}" stroke="#111" stroke-width="1"/>`)).join('');
await writeFile('artifacts/review/070-refined-source-overlay.html',`<!doctype html><meta charset="utf-8"><title>070 actual mesh source overlay</title><style>body{margin:0}svg{width:1510px;height:1270px}</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1510 1270"><image href="data:image/png;base64,${source.toString('base64')}" width="1510" height="1270"/>${outlines}${marks}</svg>`,{flag:'wx'});
console.log({samples:report.samples,groups:groups.map(({rows,...group})=>group),adjustments:report.adjustments});
