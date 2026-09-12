const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export function solveClutchSystem(matrix,rhs){
 const a=matrix.map((r,i)=>[...r,rhs[i]]),n=rhs.length;
 for(let k=0;k<n;k++){
  let best=k;for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[best][k]))best=i;
  if(Math.abs(a[best][k])<1e-14)return null;[a[k],a[best]]=[a[best],a[k]];
  const pivot=a[k][k];for(let j=k;j<=n;j++)a[k][j]/=pivot;
  for(let i=0;i<n;i++)if(i!==k){const f=a[i][k];for(let j=k;j<=n;j++)a[i][j]-=f*a[k][j];}
 }
 return a.map(r=>r[n]);
}

// Enumerate up to the coordinate dimension, including simultaneous contact
// with both jaw flanks, a slot end and a fork wall at the seated corner.
// Keep the earlier three-contact projector frozen with its original studies.
export function projectClutchSeatingVelocity(free,mass,constraints){
 const valid=v=>constraints.every(c=>dot(c.gradient,v)>=c.target-1e-10);
 if(valid(free))return {v:free,active:[],cost:0};
 let best=null;
 function candidate(indices){
  const matrix=indices.map(i=>indices.map(j=>constraints[i].gradient.reduce((s,v,k)=>s+v*constraints[j].gradient[k]/mass[k],0))),
   rhs=indices.map(i=>constraints[i].target-dot(constraints[i].gradient,free)),lambda=solveClutchSystem(matrix,rhs);
  if(!lambda||lambda.some(v=>v< -1e-12))return;
  const v=free.map((v,k)=>v+indices.reduce((s,i,j)=>s+Math.max(0,lambda[j])*constraints[i].gradient[k]/mass[k],0));
  if(!valid(v))return;
  const cost=v.reduce((s,v,k)=>s+mass[k]*(v-free[k])**2,0);
  if(!best||cost<best.cost)best={v,cost,active:indices.map((i,j)=>({...constraints[i],impulse:Math.max(0,lambda[j])}))};
 }
 function visit(indices,start){
  if(indices.length)candidate(indices);
  if(indices.length===mass.length)return;
  for(let i=start;i<constraints.length;i++)visit([...indices,i],i+1);
 }
 visit([],0);
 if(!best)throw Error('No feasible '+mass.length+'-coordinate clutch velocity');
 return best;
}

export function makeClutchSeatingProfile(profile,ratio){
 const {knots,side}=profile,sign=side==='left'?1:-1,phaseSign=-sign;
 const segment=i=>({i,slope:(knots[i+1].gap-knots[i].gap)/(knots[i+1].angle-knots[i].angle)});
 const segments=knots.slice(1).map((_,i)=>segment(i));
 function evaluate(delta,shift=0,margin=1e-7){
  if(delta<knots[0].angle-1e-10||delta>knots.at(-1).angle+1e-10)throw Error('Loaded jaw left the measured phase range: '+delta);
  let lo=0,hi=knots.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(knots[m].angle<=delta)lo=m;else hi=m;}
  const active=[segments[lo]];
  // Concave knots have two admissible normals. Include the adjacent flank
  // close to the knot, so a compressive corner reaction can arise naturally.
  if(lo>0&&delta-knots[lo].angle<margin&&segments[lo-1].slope>segments[lo].slope+1e-8)active.push(segments[lo-1]);
  if(lo+1<segments.length&&knots[lo+1].angle-delta<margin&&segments[lo].slope>segments[lo+1].slope+1e-8)active.push(segments[lo+1]);
  return active.map(({i,slope})=>({kind:'jaw-'+side+'-'+i,gap:knots[i].gap+slope*(delta-knots[i].angle)+sign*shift,
   gradient:[0,0,sign,slope],inputGradient:phaseSign*ratio*slope,segment:i,relativeAngle:delta}));
 }
 return {evaluate,profile};
}
