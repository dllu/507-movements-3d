import { readFile, writeFile } from 'node:fs/promises';

const scans = JSON.parse(await readFile('artifacts/review/064-source-leaf-scan.json','utf8'));
const marks = scans.filter(row=>row.x<=474).flatMap(row=>row.runs.slice(0,2).map(run=>[row.x,(run[0]+run[1])/2]));
const bound = [[180,360],[90,180],[40,250],[-115,-91],[0,8]];
function contour(values, count=192) {
  const [cx,cy,handle,degrees,amplitude]=values,a=degrees*Math.PI/180;
  const end=[541+38*Math.cos(a),306-38*Math.sin(a)];
  const controls=[[45,161],[cx,cy],[end[0]+handle*Math.sin(a),end[1]+handle*Math.cos(a)],end];
  const sides=[[],[]];
  for(let i=0;i<=count;i++) {
    const t=i/count,u=1-t;
    const q=[0,1].map(k=>u**3*controls[0][k]+3*u*u*t*controls[1][k]+3*u*t*t*controls[2][k]+t**3*controls[3][k]);
    const v=[0,1].map(k=>3*u*u*(controls[1][k]-controls[0][k])+6*u*t*(controls[2][k]-controls[1][k])+3*t*t*(controls[3][k]-controls[2][k]));
    const length=Math.hypot(...v),thickness=12+amplitude*Math.sin(Math.PI*t)**2;
    for(const [j,sign] of [-1,1].entries())sides[j].push([q[0]+sign*thickness*(-v[1]/length),q[1]+sign*thickness*v[0]/length]);
  }
  return {controls,sides};
}
function evaluate(values, detail=false) {
  if(values.some((v,i)=>v<bound[i][0]||v>bound[i][1]))return detail?null:1e6;
  const shape=contour(values),rows=marks.map((q,index)=>{
    const path=shape.sides[index%2];let best=Infinity;
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy)));
      best=Math.min(best,Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy));
    }
    return {point:q,residual:best};
  });
  const cost=rows.reduce((s,r)=>s+r.residual*r.residual,0)/rows.length;
  return detail?{values,controls:shape.controls,rows,rms:Math.sqrt(cost),maximum:Math.max(...rows.map(r=>r.residual)),sides:shape.sides}:cost;
}
let best=null;
for(const initial of [[260,120,150,-100,2],[290,145,160,-95,4],[220,126,148,-110,0]]) {
  let simplex=[initial,...initial.map((_,i)=>initial.map((v,j)=>v+(i===j?[12,8,12,2,1][i]:0)))];
  for(let iter=0;iter<600;iter++) {
    simplex.sort((a,b)=>evaluate(a)-evaluate(b));const center=initial.map((_,i)=>simplex.slice(0,-1).reduce((s,p)=>s+p[i],0)/initial.length);
    const worst=simplex.at(-1),reflect=center.map((v,i)=>2*v-worst[i]);
    if(evaluate(reflect)<evaluate(simplex[0])){
      const expand=center.map((v,i)=>3*v-2*worst[i]);simplex[simplex.length-1]=evaluate(expand)<evaluate(reflect)?expand:reflect;
    }else if(evaluate(reflect)<evaluate(simplex.at(-2)))simplex[simplex.length-1]=reflect;
    else {
      const contract=center.map((v,i)=>(v+worst[i])/2);
      if(evaluate(contract)<evaluate(worst))simplex[simplex.length-1]=contract;
      else simplex=simplex.map((p,j)=>j?p.map((v,i)=>(v+simplex[0][i])/2):p);
    }
  }
  simplex.sort((a,b)=>evaluate(a)-evaluate(b));const candidate=evaluate(simplex[0],true);
  if(!best||candidate.rms<best.rms)best=candidate;
}
await writeFile('artifacts/review/064-leaf-source-fit.json',JSON.stringify({method:'Regularized cubic centerline and smooth thickness variation fitted to 22 black-boundary scan midpoints. This is an unloaded source-shape study, not mechanical validation.',...best},null,2)+'\n');
console.log({values:best.values,controls:best.controls,rms:best.rms,maximum:best.maximum});
