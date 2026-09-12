import {pumpCatchRope} from './pump-catch-rope.mjs';

const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),mul=(M,v)=>M.map(r=>dot(r,v));
function solve(M,b){
  const a=M.map((r,i)=>[...r,b[i]]),n=b.length;
  for(let k=0;k<n;k++){
    let p=k;for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[p][k]))p=i;
    if(Math.abs(a[p][k])<1e-12)return null;[a[k],a[p]]=[a[p],a[k]];
    const d=a[k][k];for(let j=k;j<=n;j++)a[k][j]/=d;
    for(let i=0;i<n;i++)if(i!==k){const f=a[i][k];for(let j=k;j<=n;j++)a[i][j]-=f*a[k][j];}
  }return a.map(r=>r[n]);
}

// Between contact events, the wrapped rope, heel stop and pump bed impose
// linear constraints in generalized coordinates. Integrate that smooth ODE
// directly; unilateral events and all cam/stop contacts use the impact solver.
export function pumpCatchSmoothStep(dynamics,contact,before,time,h,angularSpeed){
  const active=before.active??[],supported=new Set(['rope','heel','pump-stop']);
  if(active.some(c=>!supported.has(c.kind)))return{unsupported:true};
  if(new Set(active.map(c=>c.kind)).size!==active.length)return{unsupported:true};
  const gradients=active.map(c=>c.gradient),hasRope=active.some(c=>c.kind==='rope');
  if(gradients.some(J=>Math.abs(dot(J,before.v))>1e-8)||hasRope&&before.q[0]>=-1e-7)return{unsupported:true};
  const at=(q,v,fraction)=>{
    if(hasRope&&q[0]>=-1e-7)return{event:'winding-end'};
    const gap=Math.min(contact.minimumRawGap(q,angularSpeed*(before.time+fraction*h)),pumpCatchRope(q,dynamics.parameters).gap,
      q[2]-(dynamics.parameters.pumpStopHeight??-Infinity));
    if(gap< -2e-8)return{event:'intermediate-contact'};
    const mass=dynamics.at(q,v),columns=gradients.map(J=>mul(mass.inverse,J)),
      lambda=solve(gradients.map(J=>columns.map(c=>dot(J,c))),gradients.map(J=>-dot(J,mass.acceleration)));
    if(!lambda)return{unsupported:true};
    if(lambda.some(f=>f< -1e-9))return{event:'constraint-release'};
    const acceleration=mass.acceleration.map((a,k)=>a+lambda.reduce((s,f,i)=>s+f*columns[i][k],0));
    return{q,v,acceleration,reactions:active.map((c,i)=>({kind:c.kind,gradient:c.gradient,force:lambda[i]}))};
  };
  const stage=(base,derivative,dt)=>base.map((v,k)=>v+dt*derivative[k]),k1=at(before.q,before.v,0);
  if(!k1.acceleration)return k1;
  const k2=at(stage(before.q,k1.v,h/2),stage(before.v,k1.acceleration,h/2),.5);if(!k2.acceleration)return k2;
  const k3=at(stage(before.q,k2.v,h/2),stage(before.v,k2.acceleration,h/2),.5);if(!k3.acceleration)return k3;
  const k4=at(stage(before.q,k3.v,h),stage(before.v,k3.acceleration,h),1);if(!k4.acceleration)return k4;
  const stages=[k1,k2,k3,k4],weights=[1/6,1/3,1/3,1/6],average=key=>before.q.map((_,k)=>stages.reduce((s,r,i)=>s+weights[i]*r[key][k],0)),
    meanVelocity=average('v'),q=stage(before.q,meanVelocity,h),v=stage(before.v,average('acceleration'),h),
    {path,...rope}=pumpCatchRope(q,dynamics.parameters),constraints=[...contact.query(q,angularSpeed*time).map(c=>({...c,gradient:[...c.gradient,0]})),rope,
      ...(dynamics.parameters.pumpStopHeight===null?[]:[{kind:'pump-stop',gap:q[2]-dynamics.parameters.pumpStopHeight,gradient:[0,0,1],inputGradient:0}])],
    minimumGap=Math.min(contact.minimumRawGap(q,angularSpeed*time),...constraints.map(c=>c.gap)),reactions=[];
  if(minimumGap< -1e-9)return{event:'new-contact'};
  for(const c of constraints)if(c.gap<=2e-8&&!active.some(a=>a.kind===c.kind)&&dot(c.gradient,v)+c.inputGradient*angularSpeed< -1e-8)return{event:'closing-contact'};
  for(let i=0;i<active.length;i++){
    const c=constraints.find(c=>c.kind===active[i].kind&&Math.abs(c.gap)<2e-8);
    if(!c||c.gradient.some((v,k)=>Math.abs(v-gradients[i][k])>1e-8))return{event:'nonlinear-constraint'};
    const impulse=h*stages.reduce((s,r,j)=>s+weights[j]*r.reactions[i].force,0);
    if(impulse<0)return{event:'constraint-release'};reactions.push({...c,impulse});
  }
  return{time,q,v,transportVelocity:meanVelocity,active:reactions,positionActive:[],slack:rope.gap,minimumGap,
    iterations:0,integration:'rk4-linear-constraints',stages:stages.map((s,i)=>({...s,weight:weights[i]}))};
}
