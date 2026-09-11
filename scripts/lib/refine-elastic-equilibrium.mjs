const maximum=a=>Math.max(...a.map(Math.abs));
function solve(matrix,rhs){
  const n=rhs.length,a=matrix.map((row,i)=>[...row,rhs[i]]);
  for(let i=0;i<n;i++){
    let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    if(Math.abs(a[pivot][i])<1e-14)return null;
    [a[i],a[pivot]]=[a[pivot],a[i]];
    for(let j=i+1;j<n;j++){const ratio=a[j][i]/a[i][i];for(let k=i;k<=n;k++)a[j][k]-=ratio*a[i][k];}
  }
  const x=Array(n).fill(0);
  for(let i=n-1;i>=0;i--){let value=a[i][n];for(let j=i+1;j<n;j++)value-=a[i][j]*x[j];x[i]=value/a[i][i];}
  return x;
}

// Local polishing only. Differentiate the independently checked analytic force
// gradient, then solve the small Newton system. Near machine energy resolution,
// require a decreasing force residual as well as an energy-roundoff bound.
export function refineElasticEquilibrium(evaluate,initial,{iterations=6,tolerance=5e-8}={}){
  let x=[...initial],state=evaluate(x);const rows=[];
  for(let iteration=0;iteration<iterations;iteration++){
    const before=maximum(state.gradient);if(before<tolerance)break;
    const n=x.length,hessian=Array.from({length:n},()=>Array(n));
    for(let i=0;i<n;i++){
      const lo=[...x],hi=[...x],h=2e-7;lo[i]-=h;hi[i]+=h;
      const a=evaluate(lo),b=evaluate(hi);
      for(let j=0;j<n;j++)hessian[j][i]=(b.gradient[j]-a.gradient[j])/(2*h);
    }
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)hessian[i][j]=hessian[j][i]=(hessian[i][j]+hessian[j][i])/2;
    let direction=solve(hessian,state.gradient.map(v=>-v));
    if(!direction||direction.some(v=>!Number.isFinite(v)))break;
    const slope=direction.reduce((sum,v,i)=>sum+v*state.gradient[i],0);if(!(slope<0))break;
    let step=Math.min(1,.01/maximum(direction)),next,candidate;
    for(let search=0;search<30;search++){
      candidate=x.map((v,i)=>v+step*direction[i]);next=evaluate(candidate);
      const energyTolerance=32*Number.EPSILON*Math.max(1,Math.abs(state.energy));
      if(Number.isFinite(next.energy)&&maximum(next.gradient)<before
        &&(next.energy<=state.energy+1e-4*step*slope||Math.abs(next.energy-state.energy)<=energyTolerance))break;
      next=null;step*=.5;
    }
    if(!next)break;
    rows.push({iteration,before,after:maximum(next.gradient),step,energyChange:next.energy-state.energy});
    x=candidate;state=next;
  }
  return{x,...state,refinement:rows,maximumGradient:maximum(state.gradient)};
}
