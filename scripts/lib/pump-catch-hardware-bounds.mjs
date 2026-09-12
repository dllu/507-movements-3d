import {surfaceTriangles} from '../../tests/helpers/solid-surface.mjs';

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>a.map((v,k)=>v-b[k]),
  norm=p=>Math.hypot(...p),box=p=>({min:[0,1,2].map(k=>Math.min(...p.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...p.map(v=>v[k])))});
function circularRange(a,b,lo,hi){
  if(hi-lo>=2*Math.PI)return[-Math.hypot(a,b),Math.hypot(a,b)];
  const f=t=>a*Math.cos(t)+b*Math.sin(t),values=[f(lo),f(hi)],phase=Math.atan2(b,a);
  for(let k=Math.ceil((lo-phase)/Math.PI);phase+k*Math.PI<=hi;k++)values.push(f(phase+k*Math.PI));
  return[Math.min(...values),Math.max(...values)];
}
function rotatedBounds(p,range){return[circularRange(p[0],-p[1],...range),circularRange(p[1],p[0],...range)];}
function triangleRadius(t){
  const area=cross(sub(t[1],t[0]),sub(t[2],t[0])),s=t.map((p,i)=>cross(p,t[(i+1)%3]));
  let minimum=Math.abs(area)>1e-20&&(s.every(v=>v>=0)||s.every(v=>v<=0))?0:Infinity;
  for(let i=0;i<3;i++){const a=t[i],d=sub(t[(i+1)%3],a),square=dot(d,d),f=square?Math.max(0,Math.min(1,-dot(a,d)/square)):0;minimum=Math.min(minimum,norm(a.map((v,k)=>v+f*d[k])));}
  return[minimum,Math.max(...t.map(norm))];
}
function radialRange(triangles,axes,center){
  let minimum=Infinity,maximum=0;
  for(const t of triangles){const r=triangleRadius(t.map(p=>axes.map((k,i)=>p[k]-center[i])));minimum=Math.min(minimum,r[0]);maximum=Math.max(maximum,r[1]);}
  return[minimum,maximum];
}
function projectedTriangles(triangles){
  const seen=new Set(),result=[];
  for(const t of triangles){const p=t.map(v=>[v[0],v[2]]);if(Math.abs(cross(sub(p[1],p[0]),sub(p[2],p[0])))<1e-15)continue;
    const key=p.map(v=>v.join(',')).sort().join('|');if(seen.has(key))continue;seen.add(key);
    result.push({p,n:p.map((v,i)=>{const d=sub(p[(i+1)%3],v),L=norm(d);return[-d[1]/L,d[0]/L];})});}
  return result;
}
function projectionGap(a,b){
  let best=-Infinity;
  for(const n of [[1,0],[0,1],...a.n,...b.n]){
    const A=a.p.map(p=>dot(p,n)),B=b.p.map(p=>dot(p,n));best=Math.max(best,Math.min(...A)-Math.max(...B),Math.min(...B)-Math.max(...A));
  }return best;
}
function slabVertices(triangle,low,high){
  let points=triangle;
  for(const [value,sign]of [[low,1],[high,-1]]){
    const next=[];for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],da=sign*(a[2]-value),db=sign*(b[2]-value);
      if(da>=0)next.push(a);if((da>=0)!==(db>=0)){const f=da/(da-db);next.push(a.map((v,k)=>v+f*(b[k]-v)));}}
    points=next;
  }return points;
}

export function pumpCatchHardwareBounds(model,{range,camRange},{tolerance=1e-6}={}){
  model.setState();const u=model.root.userData,P=u.geometry.pivot,remote=u.rearDrive.separation,roundoff=1e-10,
    parts=Object.entries(u.parts).filter(([name])=>u.families[name]!=='rope').map(([name,mesh])=>{
      const triangles=surfaceTriangles(mesh.geometry).map(t=>[t.a,t.b,t.c].map(p=>p.applyMatrix4(mesh.matrixWorld).toArray())),vertices=triangles.flat(),family=u.families[name],initial=box(vertices),swept={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
      for(const p of vertices){let xy;
        if(family==='catch'){
          const a=rotatedBounds(P,range[0]),b=rotatedBounds([p[0]-P[0],p[1]-P[1]],range[1]);xy=a.map((v,k)=>v.map((x,j)=>x+b[k][j]));
        }else if(['wheel','cam','remoteInput'].includes(family)){
          const center=family==='remoteInput'?remote:0;xy=rotatedBounds([p[0]-center,p[1]],family==='wheel'?range[0]:camRange);xy[0]=xy[0].map(v=>v+center);
        }else xy=[[p[0],p[0]],[p[1],p[1]]];
        if(family==='pump')xy[1]=range[2].map(v=>v+p[1]);
        for(let k=0;k<3;k++){swept.min[k]=Math.min(swept.min[k],k<2?xy[k][0]:p[2]);swept.max[k]=Math.max(swept.max[k],k<2?xy[k][1]:p[2]);}
      }
      const radial=new Map();return{name,family,triangles,initial,swept,radial,projected:null};
    }),primary=new Set(['hookedCatchB/pointedCamC','hookedCatchB/inputShaft','fixedTripStop/hookedCatchB','catchHeelLug/wheelHeelStop',
      'catchHeadBack/inputShaft','catchHeadBack/fixedTripStop','catchHeelLug/inputShaft'].map(s=>s.split('/').sort().join('/'))),pairs=[],
    axes=[
      {name:'main-shaft',axes:[0,1],center:[0,0],families:['wheel','cam','fixed','band']},
      {name:'remote-shaft',axes:[0,1],center:[remote,0],families:['remoteInput','fixed','band']},
      {name:'catch-pin',axes:[0,1],center:P,families:['wheel','catch']},
      ...[-.25,0,.25].map(x=>({name:'pump-axis-'+x,axes:[0,2],center:[-u.completeHardware.radius+x,u.completeHardware.z],families:['pump','fixed','band']})),
    ];
  for(let i=0;i<parts.length;i++)for(const b of parts.slice(i+1)){
    const a=parts[i];if(a.family===b.family)continue;const pair={a:a.name,b:b.name,certified:false,method:null,margin:null};pairs.push(pair);
    if(primary.has([a.name,b.name].sort().join('/'))){pair.method='primary-contact';continue;}
    const gaps=[0,1,2].map(k=>Math.max(a.swept.min[k]-b.swept.max[k],b.swept.min[k]-a.swept.max[k])-roundoff),maximum=Math.max(...gaps);
    if(maximum>=-tolerance){Object.assign(pair,{certified:true,method:'whole-motion-axis',axis:gaps.indexOf(maximum),margin:maximum});continue;}
    for(const axis of axes){
      if(![a,b].every(p=>axis.families.includes(p.family)))continue;
      for(const p of [a,b])if(!p.radial.has(axis.name))p.radial.set(axis.name,radialRange(p.triangles,axis.axes,axis.center));
      const A=a.radial.get(axis.name),B=b.radial.get(axis.name),margin=Math.max(A[0]-B[1],B[0]-A[1])-roundoff;
      if(margin>=-tolerance){Object.assign(pair,{certified:true,method:'invariant-radial-range',axis:axis.name,ranges:[A,B],margin});break;}
    }
    if(pair.certified)continue;
    if([a,b].every(p=>['pump','fixed','band'].includes(p.family))){
      for(const p of [a,b])p.projected??=projectedTriangles(p.triangles);let minimum=Infinity,failed=false,checks=0;
      outer:for(const A of a.projected)for(const B of b.projected){checks++;const g=projectionGap(A,B)-roundoff;minimum=Math.min(minimum,g);if(g< -tolerance){failed=true;break outer;}}
      if(!failed){Object.assign(pair,{certified:true,method:'invariant-xz-triangle-projection',margin:minimum,checks});continue;}
    }
    const band=a.name==='inputDriveBand'?a:b.name==='inputDriveBand'?b:null,rim=band===a?b:band===b?a:null;
    if(band&&['rearDriveRim','remoteDriveRim'].includes(rim.name)){
      const center=[rim.name==='remoteDriveRim'?remote:0,0],bandRadius=radialRange(band.triangles,[0,1],center),low=band.initial.min[2]+tolerance/2,high=band.initial.max[2]-tolerance/2;
      let maximumRadius=0,vertices=0;
      for(const t of rim.triangles)for(const p of slabVertices(t,low,high)){vertices++;maximumRadius=Math.max(maximumRadius,Math.hypot(p[0]-center[0],p[1]));}
      const margin=bandRadius[0]-maximumRadius-roundoff;
      if(vertices&&margin>=-tolerance/2)Object.assign(pair,{certified:true,method:'band-central-slab-radial-range',margin,low,high,vertices,bandRadius,maximumRadius});
    }
  }
  return{pairs,unresolved:pairs.filter(p=>!p.certified&&p.method!=='primary-contact'),primaryPairs:pairs.filter(p=>p.method==='primary-contact'),
    bodies:parts.map(p=>({name:p.name,family:p.family,swept:p.swept})),tolerance,range,camRange,
    qualification:'Whole-motion Cartesian bounds use exact trigonometric extrema of the supplied angle ranges. Coaxial radial bounds use every actual projected surface triangle, retaining bores. Pump/fixed XZ projections are invariant under vertical travel. The two input rims use their actual surfaces clipped to the band depth slab. Primary contacts and the deforming rope require separate proofs. Internal rigid-family relationships are constant and are checked separately in the surface study.'};
}
