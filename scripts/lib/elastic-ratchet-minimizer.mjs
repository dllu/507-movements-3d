const dot = (a,b) => a.reduce((sum,x,i) => sum+x*b[i],0);
const maximum = a => Math.max(...a.map(Math.abs));

// Limited-memory BFGS with an Armijo line search and bounded angular steps.
// This offline solver reports convergence; reaching its iteration cap is not
// acceptance of a spring equilibrium.
export function minimizeElasticEnergy(evaluate, initial, {
  iterations=400, tolerance=1e-7, angularStep=.04, memory=48, initialHistory=[],
}={}) {
  let x=[...initial], state=evaluate(x), history=[...initialHistory], evaluations=1, converged=false, reason='iteration-limit', iteration=0;
  for (;iteration<iterations;iteration++) {
    if(maximum(state.gradient)<tolerance){converged=true;reason='gradient';break;}
    const q=[...state.gradient],alpha=[];
    for(let i=history.length-1;i>=0;i--){const row=history[i];alpha[i]=row.rho*dot(row.s,q);for(let j=0;j<q.length;j++)q[j]-=alpha[i]*row.y[j];}
    const last=history.at(-1),scale=last?dot(last.s,last.y)/dot(last.y,last.y):1;
    let direction=q.map(v=>v*scale);
    for(let i=0;i<history.length;i++){const row=history[i],beta=row.rho*dot(row.y,direction);for(let j=0;j<q.length;j++)direction[j]+=row.s[j]*(alpha[i]-beta);}
    direction=direction.map(v=>-v);
    let slope=dot(direction,state.gradient);
    if(!(slope<0)){history=[];direction=state.gradient.map(v=>-v);slope=-dot(state.gradient,state.gradient);}
    let step=Math.min(1,angularStep/maximum(direction)),next,candidate;
    for(let search=0;search<45;search++){
      candidate=x.map((v,i)=>v+step*direction[i]);next=evaluate(candidate);evaluations++;
      if(Number.isFinite(next.energy)&&next.energy<=state.energy+1e-4*step*slope)break;
      next=null;step*=.5;
    }
    if(!next){if(history.length){history=[];continue;}reason='line-search';break;}
    const s=candidate.map((v,i)=>v-x[i]),y=next.gradient.map((v,i)=>v-state.gradient[i]),curvature=dot(s,y);
    if(maximum(s)<=1e-13){
      // Armijo can accept equality after backtracking below floating-point
      // energy resolution. Report stagnation instead of spending the entire
      // iteration budget at the same pose. This does not imply convergence.
      if(history.length){history=[];continue;}
      reason='step-resolution';break;
    }
    if(curvature>1e-14*Math.sqrt(dot(s,s)*dot(y,y))){history.push({s,y,rho:1/curvature});if(history.length>memory)history.shift();}
    x=candidate;state=next;
  }
  return{x,...state,history,iterations:iteration,evaluations,converged,reason,maximumGradient:maximum(state.gradient)};
}
