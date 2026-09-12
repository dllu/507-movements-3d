import {pumpCatchSlackStep,makePumpCatchSlackDynamics} from './pump-catch-slack-dynamics.mjs';
import {pumpCatchRope} from './pump-catch-rope.mjs';
export {makePumpCatchSlackDynamics};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),mul=(M,v)=>M.map(r=>dot(r,v));
function solve(M,b){
  const a=M.map((row,i)=>[...row,b[i]]),n=b.length;
  for(let k=0;k<n;k++){let pivot=k;for(let j=k+1;j<n;j++)if(Math.abs(a[j][k])>Math.abs(a[pivot][k]))pivot=j;
    if(Math.abs(a[pivot][k])<1e-12)return null;[a[k],a[pivot]]=[a[pivot],a[k]];const d=a[k][k];for(let j=k;j<=n;j++)a[k][j]/=d;
    for(let i=0;i<n;i++)if(i!==k){const f=a[i][k];for(let j=k;j<=n;j++)a[i][j]-=f*a[k][j];}}
  return a.map(row=>row[n]);
}
function projection(free,mass,constraints){
  const valid=v=>constraints.every(c=>dot(c.gradient,v)>=c.target-1e-9);if(valid(free))return{v:free,active:[]};
  const columns=constraints.map(c=>mul(mass.inverse,c.gradient));let best=null;
  const candidate=ids=>{
    const matrix=ids.map(i=>ids.map(j=>dot(constraints[i].gradient,columns[j]))),rhs=ids.map(i=>constraints[i].target-dot(constraints[i].gradient,free)),lambda=solve(matrix,rhs);
    if(!lambda||lambda.some(v=>v<0))return;const v=free.map((v,k)=>v+ids.reduce((s,i,j)=>s+lambda[j]*columns[i][k],0));if(!valid(v))return;
    const d=v.map((v,k)=>v-free[k]),cost=dot(d,mul(mass.M,d));if(!best||cost<best.cost)best={v,cost,active:ids.map((i,j)=>({...constraints[i],impulse:lambda[j]}))};
  };
  for(let i=0;i<constraints.length;i++){candidate([i]);for(let j=i+1;j<constraints.length;j++){candidate([i,j]);for(let k=j+1;k<constraints.length;k++)candidate([i,j,k]);}}
  return best;
}

// Position transport locates the finite contact. The physical velocity is
// projected separately from the free momentum, so an impact cannot leave a
// closing velocity at a seated face. Position transport is recorded explicitly;
// it is not silently substituted for the post-impact velocity.
export function pumpCatchImpactStep(dynamics,contact,before,time,h,angularSpeed){
  const transport=pumpCatchSlackStep(dynamics,contact,before,time,h,angularSpeed);if(transport.failed)return transport;
  const mass=dynamics.at(before.q,before.v),free=before.v.map((v,k)=>v+h*mass.acceleration[k]),q=transport.q,
    {path,...rope}=pumpCatchRope(q,dynamics.parameters),candidates=[...contact.query(q,angularSpeed*time).map(c=>({...c,gradient:[...c.gradient,0]})),rope],
    constraints=candidates.filter(c=>c.gap<=2e-8).map(c=>({...c,target:-c.inputGradient*angularSpeed})),result=projection(free,mass,constraints);
  if(!result)return{failed:'Infeasible final impact velocity',time,q};
  return{...transport,transportVelocity:transport.v,positionActive:transport.active,v:result.v,active:result.active,
    impactVelocityChange:Math.hypot(...result.v.map((v,k)=>v-transport.v[k]))};
}
