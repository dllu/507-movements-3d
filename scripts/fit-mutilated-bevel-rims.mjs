import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeMutilatedBevelCandidate } from './lib/mutilated-bevel-candidate.mjs';

function solve(a,b){
  const rows=a.map((r,i)=>[...r,b[i]]),n=b.length;
  for(let k=0;k<n;k++){
    let pivot=k;for(let j=k+1;j<n;j++)if(Math.abs(rows[j][k])>Math.abs(rows[pivot][k]))pivot=j;
    [rows[k],rows[pivot]]=[rows[pivot],rows[k]];const scale=rows[k][k];if(Math.abs(scale)<1e-12)throw new Error('Singular fit');
    for(let j=k;j<=n;j++)rows[k][j]/=scale;
    for(let i=0;i<n;i++)if(i!==k){const factor=rows[i][k];for(let j=k;j<=n;j++)rows[i][j]-=factor*rows[k][j];}
  }
  return rows.map(r=>r[n]);
}
function observations(model){
  model.root.updateMatrixWorld(true);const b=model.root.userData.blocks,rows=[];
  const add=(name,world,source,inner=null)=>rows.push({name,world,source,inner});
  for(const [name,sign,source]of [['gearA',-1,{top:[250,179],bottom:[251,800],innerTop:[366,299],innerBottom:[366,690],shaft:[80,494]}],
    ['gearB',1,{top:[1040,174],bottom:[1046,818],innerTop:[938,268],innerBottom:[938,690],shaft:[1238,497]}]]){
    const gear=b[name],root=gear.userData.toothMeshes[0].geometry.userData.root,points=[];
    for(const tooth of gear.userData.toothMeshes){const p=tooth.geometry.attributes.position;for(let i=0;i<p.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(tooth.matrixWorld));}
    const top=points.reduce((a,b)=>a.y>b.y?a:b),bottom=points.reduce((a,b)=>a.y<b.y?a:b);
    add(name+' outer upper tooth',[top.x,top.y],source.top);add(name+' outer lower tooth',[bottom.x,bottom.y],source.bottom);
    add(name+' inner upper body rim',[sign*root.z,root.radius],source.innerTop,'output');
    add(name+' inner lower body rim',[sign*root.z,-root.radius],source.innerBottom,'output');
    add(name+' shaft end',[sign*(root.z+.55),0],source.shaft);
  }
  const root=b.driverC.userData.toothMeshes[0].geometry.userData.root;
  add('C front heel',[0,-root.z],[653,824]);add('C inner face',[0,-root.z],[653,691],'driver');
  add('C rear body plane',[0,-(root.z+.14)],[653,872]);
  add('C upper collar left',[-.22,-(root.z+.19)],[584,882]);add('C upper collar right',[.22,-(root.z+.19)],[728,882]);
  add('C neck lower left',[-.11,-(root.z+.52)],[616,984]);add('C neck lower right',[.11,-(root.z+.52)],[688,984]);
  add('C lower collar left',[-.22,-(root.z+.56)],[584,998]);add('C lower collar right',[.22,-(root.z+.56)],[728,998]);
  add('C shaft end',[0,-(root.z+1.02)],[651,1152]);
  return rows;
}
function fit(driverTeeth,mode){
  const model=makeMutilatedBevelCandidate({driverTeeth}),points=observations(model),n=mode==='separate'?5:mode==='shared'?4:3;
  const matrix=Array.from({length:n},()=>Array(n).fill(0)),rhs=Array(n).fill(0),equations=[];
  for(const point of points)for(let axis=0;axis<2;axis++){
    const coefficient=Array(n).fill(0),value=point.world[axis]*(axis===1?-1:1);
    coefficient[axis+1]=1;
    if(point.inner&&mode!=='fixed')coefficient[mode==='separate'&&point.inner==='driver'?4:3]=value;
    else coefficient[0]=value*(point.inner?.66:1);
    equations.push({point,axis,coefficient});
    for(let i=0;i<n;i++){rhs[i]+=coefficient[i]*point.source[axis];for(let j=0;j<n;j++)matrix[i][j]+=coefficient[i]*coefficient[j];}
  }
  const solution=solve(matrix,rhs),rows=points.map(point=>{
    const predicted=[0,1].map(axis=>{const eq=equations.find(e=>e.point===point&&e.axis===axis);return eq.coefficient.reduce((s,v,i)=>s+v*solution[i],0);});
    return{...point,predicted,error:Math.hypot(...predicted.map((v,i)=>v-point.source[i]))};
  });
  return{driverTeeth,outputTeeth:32,mode,scale:solution[0],origin:solution.slice(1,3),
    outputInnerScale:mode==='fixed'?.66:solution[3]/solution[0],driverInnerScale:mode==='fixed'?.66:solution[mode==='shared'?3:4]/solution[0],
    rms:Math.sqrt(rows.reduce((s,r)=>s+r.error*r.error,0)/rows.length),maximumError:Math.max(...rows.map(r=>r.error)),rows};
}
const fits=[fit(40,'fixed'),fit(40,'shared'),...Array.from({length:5},(_,i)=>fit(36+2*i,'separate'))],report={movement:74,status:'isolated-source-rim-fit',productionChanged:false,fits,
  qualification:'Twenty hand-picked source landmarks fitted with one uniform image scale and translation. Output and input inner face distances may be independent: their working faces only need a common radial overlap. Upper/lower tooth extrema use actual posed Float32 vertices; body and shaft landmarks use their generating profiles. The engraving is asymmetric and does not identify pitch circles or exact counts. This measures reconstruction choices; it is not an exact tooth-count recovery or contact acceptance.'};
await writeFile('artifacts/review/074-source-rim-fit.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const best=fits.filter(r=>r.mode==='separate').sort((a,b)=>a.rms-b.rms)[0],source=await readFile('artifacts/reference/brown-074-detail.png');
const marks=best.rows.map((r,i)=>`<line x1="${r.source[0]}" y1="${r.source[1]}" x2="${r.predicted[0]}" y2="${r.predicted[1]}" stroke="#00ffff" stroke-width="2"/><circle cx="${r.source[0]}" cy="${r.source[1]}" r="4" fill="#00ffff"/><circle cx="${r.predicted[0]}" cy="${r.predicted[1]}" r="4" fill="#ff40ff"/><text x="${r.source[0]+7}" y="${r.source[1]-9}" fill="#00ffff" font-size="14">${i}</text>`).join('\n');
await writeFile('artifacts/review/074-source-rim-fit.svg',`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1320 1370"><image width="1320" height="1370" xlink:href="data:image/png;base64,${source.toString('base64')}"/>${marks}</svg>\n`,{flag:'wx'});
console.log(fits.map(({rows,...r})=>r));
