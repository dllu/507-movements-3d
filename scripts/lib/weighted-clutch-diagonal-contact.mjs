const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function solve(matrix,rhs){
 const a=matrix.map((r,i)=>[...r,rhs[i]]),n=rhs.length;
 for(let k=0;k<n;k++){
  let best=k;for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[best][k]))best=i;
  if(Math.abs(a[best][k])<1e-14)return null;[a[k],a[best]]=[a[best],a[k]];
  const pivot=a[k][k];for(let j=k;j<=n;j++)a[k][j]/=pivot;
  for(let i=0;i<n;i++)if(i!==k){const factor=a[i][k];for(let j=k;j<=n;j++)a[i][j]-=factor*a[k][j];}
 }
 return a.map(r=>r[n]);
}

export function projectWeightedClutchVelocity(free,mass,constraints){
 const valid=v=>constraints.every(c=>dot(c.gradient,v)>=c.target-1e-10);
 if(valid(free))return {v:free,active:[],cost:0};
 let best=null;
 function candidate(indices){
  const matrix=indices.map(i=>indices.map(j=>constraints[i].gradient.reduce((s,v,k)=>s+v*constraints[j].gradient[k]/mass[k],0))),
   rhs=indices.map(i=>constraints[i].target-dot(constraints[i].gradient,free)),lambda=solve(matrix,rhs);
  if(!lambda||lambda.some(v=>v<0))return;
  const v=free.map((v,k)=>v+indices.reduce((s,i,j)=>s+lambda[j]*constraints[i].gradient[k]/mass[k],0));
  if(!valid(v))return;
  const cost=v.reduce((s,v,k)=>s+mass[k]*(v-free[k])**2,0);
  if(!best||cost<best.cost)best={v,cost,active:indices.map((i,j)=>({...constraints[i],impulse:lambda[j]}))};
 }
 for(let i=0;i<constraints.length;i++){
  candidate([i]);for(let j=i+1;j<constraints.length;j++){candidate([i,j]);for(let k=j+1;k<constraints.length;k++)candidate([i,j,k]);}
 }
 if(!best)throw Error('No feasible three-coordinate unilateral velocity');
 return best;
}
