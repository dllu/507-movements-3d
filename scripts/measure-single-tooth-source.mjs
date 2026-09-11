import { readFile, writeFile } from 'node:fs/promises';
import { singleToothSource } from './lib/single-tooth-source-driver.mjs';
import { makeSingleToothProfileMotion } from './lib/single-tooth-index-motion.mjs';

const name=process.env.CANDIDATE_PROFILE??'source-envelope';
const {default:profile}=await import(`./lib/single-tooth-${name}-profile.mjs`);
const {anchor,scale,toothReadings}=singleToothSource;
const motion=makeSingleToothProfileMotion(profile),p=motion.parameters,state=motion.atTime(0);
const transform=(q,a,x=0)=>[anchor[0]+scale*(q[0]*Math.cos(a)-q[1]*Math.sin(a)+x),
  anchor[1]-scale*(q[0]*Math.sin(a)+q[1]*Math.cos(a))];
const driver=profile.driver[0].map(q=>transform(q,state.inputAngle));
const output=profile.output[0].map(q=>transform(q,state.outputAngle,p.centerDistance));
const study=JSON.parse(await readFile('artifacts/review/068-source-layout-study.json','utf8'));
const nearest=(q,path)=>path.reduce((best,a,i)=>{
  const b=path[(i+1)%path.length],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/den)):0;
  return Math.min(best,Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy));
},Infinity);
const groups=[['driverCircle',study.driverFit.points,driver],['tooth',toothReadings,driver],
  ['outputTips',study.outputFit.points,output],['notchRoots',study.rootFit.points,output]].map(([group,points,contour])=>{
  const rows=points.map(point=>({point,residual:nearest(point,contour)}));
  return {name:group,rows,maximumResidual:Math.max(...rows.map(r=>r.residual)),rmsResidual:Math.sqrt(rows.reduce((s,r)=>s+r.residual*r.residual,0)/rows.length)};
});
const report={movement:68,status:'candidate-source-fit',profile:name,anchor,scale,
  method:profile.motionRows?
    'One common orthographic transform. Fitted driver circle and independently read tooth/output boundaries. The traced tooth relief is trimmed to the rim and widened by 0.08 radians; the output uses U notches and circular locking hollows. Its pose follows an isolated quasistatic projection. Source fit is not force or dynamics acceptance.':
    'One common orthographic transform, fitted driver circle and independently read tooth/output boundaries. The tooth was traced from these same readings; its small residual is a fit result, not independent mechanical evidence. The output is generated from the prescribed trial motion and full tooth sweep.',groups};
const prefix=`artifacts/review/068-${name}`;
await writeFile(`${prefix}-source-fit.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const background=(await readFile('artifacts/reference/brown-068-detail.png')).toString('base64');
const contour=(ring,color)=>`<polyline points="${[...ring,ring[0]].map(q=>q.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`;
const marks=groups.flatMap(g=>g.rows.map(({point:q})=>`<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="none" stroke="${g.name.startsWith('output')||g.name==='notchRoots'?'#00a0ff':'#f00050'}" stroke-width="1.5"/>`)).join('');
await writeFile(`${prefix}-source-overlay.html`,`<!doctype html><meta charset="utf-8"><title>068 candidate overlay</title><style>body{margin:0}svg{width:1450px;height:1150px}</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1450 1150"><image href="data:image/png;base64,${background}" width="1450" height="1150"/>${contour(driver,'#f00050')}${contour(output,'#00a0ff')}${marks}</svg>`,{flag:'wx'});
console.log(groups.map(({rows,...g})=>g));
