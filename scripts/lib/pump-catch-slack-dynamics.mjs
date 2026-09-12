import {makePumpCatchDynamics} from './pump-catch-dynamics.mjs';
import {rotate2} from './pump-catch-contact.mjs';
import {pumpCatchRope} from './pump-catch-rope.mjs';

const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),mul=(M,v)=>M.map(r=>dot(r,v));
function solve(M,b){
  const a=M.map((row,i)=>[...row,b[i]]),n=b.length;
  for(let k=0;k<n;k++){let pivot=k;for(let j=k+1;j<n;j++)if(Math.abs(a[j][k])>Math.abs(a[pivot][k]))pivot=j;
    if(Math.abs(a[pivot][k])<1e-12)return null;[a[k],a[pivot]]=[a[pivot],a[k]];const d=a[k][k];for(let j=k;j<=n;j++)a[k][j]/=d;
    for(let i=0;i<n;i++)if(i!==k){const f=a[i][k];for(let j=k;j<=n;j++)a[i][j]-=f*a[k][j];}}
  return a.map(row=>row[n]);
}
export function makePumpCatchSlackDynamics(model,{loadMass=1,gravity=9.81,drag=0,ropeLength=4.75}={}){
  const bare=makePumpCatchDynamics(model,{loadMass:0,gravity,drag}),radius=bare.parameters.radius;
  const at=(q,v)=>{
    const b=bare.at(q.slice(0,2),v.slice(0,2)),M=b.M.map(row=>[...row,0]);M.push([0,0,loadMass]);
    const inverse=b.inverse.map(row=>[...row,0]);inverse.push([0,0,1/loadMass]);const force=[...b.force,-loadMass*gravity];
    return{M,inverse,force,acceleration:mul(inverse,force),energy:b.energy+.5*loadMass*v[2]**2+loadMass*gravity*q[2]};
  };
  return{at,parameters:{...bare.parameters,loadMass,radius,ropeLength,rope:'Finite attached rope with winding, straight free span and unilateral tension; independent vertical pump coordinate. No assumed stroke stop.'}};
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
export function pumpCatchSlackStep(dynamics,contact,before,time,h,angularSpeed,trace=null){
  const mass=dynamics.at(before.q,before.v),free=before.v.map((v,k)=>v+h*mass.acceleration[k]);
  const rope=q=>{const {path,...constraint}=pumpCatchRope(q,dynamics.parameters);return constraint;};
  const contacts=q=>[...contact.query(q,angularSpeed*time).map(c=>({...c,gradient:[...c.gradient,0]})),
    rope(q)];
  const initial=before.q.map((v,k)=>v+h*free[k]);let q=initial.slice();
  for(let iteration=0;iteration<24;iteration++){
    const constraints=contacts(q).map(c=>({...c,target:(dot(c.gradient,q.map((v,k)=>v-before.q[k]))-c.gap)/h})),result=projection(free,mass,constraints);
    if(!result)return{failed:'Infeasible linear contacts',time,q};
    const next=before.q.map((v,k)=>v+h*result.v[k]),change=Math.max(...next.map((v,k)=>Math.abs(v-q[k])));
    trace?.push({iteration,q,next,change,active:result.active,contacts:constraints.length});q=next;
    // At a faceted corner, equally admissible active faces can alternate by
    // a few 1e-10 radians. Require sub-nanounit pose convergence, then check
    // actual gaps separately; independent spatial reactions are audited too.
    if(change<1e-9){const final=contacts(q),gap=Math.min(contact.minimumRawGap(q,angularSpeed*time),...final.map(c=>c.gap));if(gap< -2e-8)return{failed:'Remaining finite penetration',time,q,gap};
      return{time,q,v:result.v,active:result.active,iterations:iteration+1,minimumGap:gap,slack:rope(q).gap};}
  }
  // At a cam vertex seated in the hook's reentrant corner, two active faces
  // determine the same material point. Solve that pin-to-point closure from
  // two circle intersections, then require the same unilateral mass-metric
  // projection and finite-gap checks as every other step. This proposes a
  // contact candidate; it does not prescribe or reseat the moving catch.
  const pivot=dynamics.parameters.pivot,pivotRadius=Math.hypot(...pivot),vertexIds=new Map(contact.hook.points.map((p,i)=>[p.join(','),i])),proposals=[],seen=new Set();
  for(const c of contact.query(q,angularSpeed*time)){
    const f=c.feature,obstacle=contact[c.kind],obstacleIds=new Map(obstacle.points.map((p,i)=>[p.join(','),i]));
    const pairs=f.pointOn==='hook'?[
      [f.vertex,obstacleIds.get(obstacle.boundary[f.edge].a.join(','))],[f.vertex,obstacleIds.get(obstacle.boundary[f.edge].b.join(','))]
    ]:[
      [vertexIds.get(contact.hook.boundary[f.edge].a.join(',')),f.vertex],[vertexIds.get(contact.hook.boundary[f.edge].b.join(',')),f.vertex]
    ];
    for(const[hookId,otherId]of pairs){const key=c.kind+':'+hookId+':'+otherId;if(seen.has(key))continue;seen.add(key);
      const local=contact.hook.points[hookId],r=Math.hypot(...local),target=rotate2(obstacle.points[otherId],c.kind==='stop'?0:angularSpeed*time),distance=Math.hypot(...target);
      if(distance>pivotRadius+r||distance<Math.abs(pivotRadius-r)||distance<1e-10)continue;
      const along=(pivotRadius**2-r**2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,pivotRadius**2-along**2));
      for(const sign of [-1,1]){
        const P=[(along*target[0]-sign*height*target[1])/distance,(along*target[1]+sign*height*target[0])/distance],arm=target.map((v,k)=>v-P[k]),
          near=(angle,reference)=>reference+Math.atan2(Math.sin(angle-reference),Math.cos(angle-reference)),
          wheel=near(Math.atan2(P[1],P[0])-Math.atan2(pivot[1],pivot[0]),q[0]),hook=near(Math.atan2(arm[1],arm[0])-Math.atan2(local[1],local[0]),q[1]);
        if(Math.abs(wheel-q[0])>.02||Math.abs(hook-q[1])>.02)continue;
        const pose=[wheel,hook,initial[2]];
        for(let i=0;i<12;i++){const c=rope(pose);if(c.gap>=-1e-10||Math.abs(c.gradient[2])<1e-8)break;pose[2]-=c.gap/c.gradient[2];}
        const all=contacts(pose);if(contact.minimumRawGap(pose,angularSpeed*time)<-2e-8||all.some(c=>c.gap< -2e-8))continue;
        const constraints=all.map(c=>({...c,target:dot(c.gradient,pose.map((v,k)=>(v-before.q[k])/h))-c.gap/h})),result=projection(free,mass,constraints);
        if(!result)continue;const next=before.q.map((v,k)=>v+h*result.v[k]);if(Math.max(...next.map((v,k)=>Math.abs(v-pose[k])))>1e-9)continue;
        const gap=Math.min(contact.minimumRawGap(next,angularSpeed*time),...contacts(next).map(c=>c.gap));if(gap< -2e-8)continue;
        proposals.push({time,q:next,v:result.v,active:result.active,iterations:25,minimumGap:gap,slack:rope(next).gap,cost:result.cost,
          cornerClosure:{kind:c.kind,hookVertex:hookId,obstacleVertex:otherId}});
      }
    }
  }
  if(proposals.length)return proposals.sort((a,b)=>a.cost-b.cost)[0];
  return{failed:'Nonlinear contact iteration did not converge',time,q};
}
