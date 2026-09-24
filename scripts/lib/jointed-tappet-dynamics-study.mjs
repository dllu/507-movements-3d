import{add,sub,rotate}from'./finite-plate-study.mjs';

const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>a[0]*b[1]-a[1]*b[0],
  clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function linearSolve(matrix,rhs){
  const n=rhs.length,a=matrix.map((r,i)=>[...r,rhs[i]]);
  for(let i=0;i<n;i++){
    let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    if(Math.abs(a[pivot][i])<1e-13)return null;[a[i],a[pivot]]=[a[pivot],a[i]];
    const d=a[i][i];for(let j=i;j<=n;j++)a[i][j]/=d;
    for(let j=0;j<n;j++)if(j!==i){const f=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=f*a[i][k];}
  }
  return a.map(r=>r[n]);
}
function profileFrom(mesh){
  const shape=mesh.geometry.parameters.shapes[0],points=[];
  for(const p of shape.getPoints(1)){const q=[Math.fround(p.x),Math.fround(p.y)];if(!points.length||Math.hypot(...sub(q,points.at(-1)))>1e-12)points.push(q);}
  if(Math.hypot(...sub(points[0],points.at(-1)))<1e-12)points.pop();
  return points.map((a,i)=>{const b=points[(i+1)%points.length],d=sub(b,a);return{a,b,d,square:dot(d,d),index:i};});
}
function circleFeatures(edges,point,radius,padding){
  const rows=[];let inside=false,best=Infinity;
  for(const e of edges){
    if((e.a[1]>point[1])!==(e.b[1]>point[1])&&point[0]<(e.b[0]-e.a[0])*(point[1]-e.a[1])/(e.b[1]-e.a[1])+e.a[0])inside=!inside;
    const t=clamp(((point[0]-e.a[0])*e.d[0]+(point[1]-e.a[1])*e.d[1])/e.square,0,1),
      x=e.a[0]+t*e.d[0],y=e.a[1]+t*e.d[1],dx=point[0]-x,dy=point[1]-y,distance=Math.hypot(dx,dy);
    best=Math.min(best,distance);if(distance>radius+padding)continue;
    const normal=distance>1e-14?[dx/distance,dy/distance]:[e.d[1]/Math.sqrt(e.square),-e.d[0]/Math.sqrt(e.square)];
    if(rows.some(r=>Math.hypot(r.point[0]-x,r.point[1]-y)<1e-9&&dot(r.normal,normal)>1-1e-10))continue;
    rows.push({index:e.index,point:[x,y],normal,gap:distance-radius});
  }
  if(inside)for(const row of rows){row.gap=-row.gap-2*radius;row.normal=row.normal.map(v=>-v);}
  return{rows,gap:(inside?-1:1)*best-radius,inside};
}

export function makeJointedTappetDynamics(candidate,{period=12,load=3,damping=[.08,.008,1,.003]}={}){
  const u=candidate.root.userData,p=u.geometry,density=1/u.masses.dog.volume,
    mass=Object.fromEntries(Object.entries(u.masses).map(([k,m])=>[k,{mass:density*m.volume,c:m.centroid.slice(0,2),I:density*m.polar}])),
    wheelEdges=profileFrom(u.parts.wheelBody),dogStopEdges=profileFrom(u.parts.dogStopSector),restEdges=profileFrom(u.parts.tappetRestSector),
    dogPin=sub(p.dogStop,p.B),restPin=sub(p.Cstop,p.C),strikeStart=p.strikeArmStart??p.B,barAxis=sub(p.end,strikeStart),barSquare=dot(barAxis,barAxis),omega=2*Math.PI/period;
  const matrices=(x,v,dt=0)=>{
    const[q,alpha,theta,beta]=x,b=rotate(mass.dog.c,alpha),coupling=dot(p.B,b),
      Mqq=mass.tappet.I+dot(p.B,p.B)+mass.dog.I+2*coupling,Mqa=mass.dog.I+coupling,Maa=mass.dog.I,
      k=-cross(p.B,b),C=[k*(2*v[0]*v[1]+v[1]*v[1]),-k*v[0]*v[0],0,0],
      dogArm=rotate(mass.dog.c,q+alpha),dogPosition=add(rotate(p.B,q),dogArm),barPosition=rotate(mass.tappet.c,q),
      G=[-9.81*(mass.tappet.mass*barPosition[0]+dogPosition[0]),-9.81*dogArm[0],-load,-9.81*mass.holding.mass*rotate(mass.holding.c,beta)[0]],
      M=[[Mqq,Mqa,0,0],[Mqa,Maa,0,0],[0,0,mass.wheel.I,0],[0,0,0,mass.holding.I]],
      effective=M.map((r,i)=>r.map((a,j)=>a+(i===j?dt*damping[i]:0))),
      determinant=effective[0][0]*effective[1][1]-effective[0][1]**2;
    if(determinant<=0)throw new Error('Mass matrix is not positive definite');
    const inverse=[[effective[1][1]/determinant,-effective[0][1]/determinant,0,0],[-effective[0][1]/determinant,effective[0][0]/determinant,0,0],
      [0,0,1/effective[2][2],0],[0,0,0,1/effective[3][3]]];
    return{M,effective,inverse,G,C};
  };
  const constraints=(x,time,padding=.006)=>{
    const[q,alpha,theta,beta]=x,rows=[],gaps={},pivotB=add(p.C,rotate(p.B,q)),noseB=add(pivotB,rotate(p.V,q+alpha)),
      noseH=add(p.PH,rotate(p.holdingNose,beta));
    for(const[kind,center,pivot]of[['B',noseB,pivotB],['H',noseH,p.PH]]){
      const result=circleFeatures(wheelEdges,rotate(center,-theta),p.noseRadius,padding);gaps[kind]=result.gap;
      for(const f of result.rows){const normal=rotate(f.normal,theta),point=rotate(f.point,theta),wheelMoment=-cross(center,normal),
        J=kind==='B'?[cross(sub(center,p.C),normal),cross(sub(center,pivot),normal),wheelMoment,0]:[0,0,wheelMoment,cross(sub(center,pivot),normal)];
        rows.push({id:kind+':'+f.index,kind,gap:f.gap,J,point,normal});}
    }
    for(const[kind,edges,pin,angle,radius,index]of[['dogStop',dogStopEdges,dogPin,alpha,p.dogStopRadius,1],
      ['restStop',restEdges,restPin,q,p.CstopRadius,0]]){
      const result=circleFeatures(edges,rotate(pin,-angle),radius,padding);gaps[kind]=result.gap;
      for(const f of result.rows){const normal=rotate(f.normal,angle),J=[0,0,0,0];J[index]=-cross(pin,normal);rows.push({id:kind+':'+f.index,kind,gap:f.gap,J});}
    }
    const stud=rotate(p.studVector,-omega*time),local=rotate(sub(stud,p.C),-q),fraction=clamp(dot(sub(local,strikeStart),barAxis)/barSquare,0,1),
      center=add(strikeStart,barAxis.map(v=>v*fraction)),delta=sub(local,center),distance=Math.hypot(...delta),normal=rotate(delta.map(v=>v/distance),q),
      gap=distance-p.barRadius-p.studRadius;gaps.stud=gap;
    if(gap<padding)rows.push({id:'stud',kind:'stud',gap,J:[-cross(sub(stud,p.C),normal),0,0,0],
      inputNormalVelocity:dot(normal,[omega*stud[1],-omega*stud[0]]),point:stud,normal});
    return{rows,gaps};
  };
  const energy=(x,v)=>{
    const[q,alpha,theta,beta]=x,{M}=matrices(x,v),kinetic=.5*dot(v,M.map(r=>dot(r,v))),
      potential=9.81*(mass.tappet.mass*rotate(mass.tappet.c,q)[1]+add(rotate(p.B,q),rotate(mass.dog.c,q+alpha))[1]
        +mass.holding.mass*rotate(mass.holding.c,beta)[1]);
    return{kinetic,potential,total:kinetic+potential};
  };
  return{parameters:{period,load,damping,omega,density,mass},matrices,constraints,energy,initial:{x:[0,0,p.wheelStart,0],v:[0,0,0,0],time:0}};
}

export function solveContactProjection(inverse,free,rows,b,lastIds=[]){
  const directions=rows.map(r=>inverse.map(row=>dot(row,r.J))),gram=rows.map(r=>directions.map(d=>dot(r.J,d))),
    rhs=rows.map((r,i)=>b[i]-dot(r.J,free)),n=rows.length;
  const assess=active=>{
    const lambda=linearSolve(active.map(i=>active.map(j=>gram[i][j])),active.map(i=>rhs[i]));
    if(!lambda||lambda.some(v=>v< -1e-9))return null;
    const v=free.map((a,k)=>a+active.reduce((s,i,j)=>s+directions[i][k]*lambda[j],0)),slack=rows.map((r,i)=>dot(r.J,v)-b[i]);
    if(slack.some(a=>a< -1e-8))return null;
    return{v,impulses:rows.map((_,i)=>{const j=active.indexOf(i);return j<0?0:Math.max(0,lambda[j]);}),active:active.map(i=>rows[i].id),
      residual:Math.max(0,...slack.map(a=>-a),...active.map(i=>Math.abs(slack[i])))};
  };
  if(rhs.every(v=>v<=1e-10))return{v:free,impulses:rows.map(()=>0),active:[],residual:Math.max(0,...rhs)};
  const previous=lastIds.map(id=>rows.findIndex(r=>r.id===id)).filter(i=>i>=0);
  if(previous.length){const old=assess(previous);if(old)return old;}
  const lambda=Array(n).fill(0);
  for(let iteration=0;iteration<150;iteration++)for(let i=0;i<n;i++){
    if(gram[i][i]<1e-14)continue;const slack=dot(gram[i],lambda)-rhs[i];lambda[i]=Math.max(0,lambda[i]-slack/gram[i][i]);
  }
  const probable=Array.from({length:n},(_,i)=>i).filter(i=>lambda[i]>1e-10).sort((a,b)=>lambda[b]-lambda[a]),
    candidates=[...probable,...Array.from({length:n},(_,i)=>i).filter(i=>!probable.includes(i))];
  if(probable.length<=4){const quick=assess(probable);if(quick)return quick;}
  let found=null;
  const choose=(active,start,left)=>{
    if(!left){found=assess(active);return;}
    for(let i=start;i<=candidates.length-left&&!found;i++)choose([...active,candidates[i]],i+1,left-1);
  };
  for(let size=1;size<=Math.min(4,n)&&!found;size++)choose([],0,size);
  return found;
}

export function advanceJointedTappetStep(physics,state,dt){
  const time=state.time+dt,x0=state.x,v0=state.v;
  let x=x0.map((a,i)=>a+dt*v0[i]),v=[...v0],lastIds=state.active??[],solution=null;
  for(let iteration=0;iteration<32;iteration++){
    const{M,inverse,G,C}=physics.matrices(x,v,dt),rhs=M.map((row,i)=>dot(row,v0)+dt*(G[i]-C[i])),free=inverse.map(row=>dot(row,rhs)),
      contact=physics.constraints(x,time),b=contact.rows.map(row=>(dot(row.J,x.map((a,i)=>a-x0[i]))-row.gap)/dt),
      projected=solveContactProjection(inverse,free,contact.rows,b,lastIds);
    if(!projected)return{okay:false,reason:'contact-projection-infeasible',time,dt,x,contact};
    const next=x0.map((a,i)=>a+dt*projected.v[i]),change=Math.max(...next.map((a,i)=>Math.abs(a-x[i])));
    v=projected.v;x=next;lastIds=projected.active;solution={...projected,rows:contact.rows,iterations:iteration+1};
    if(change<1e-11){
      const final=physics.constraints(x,time),minimumGap=Math.min(...Object.values(final.gaps));
      if(minimumGap< -2e-9)return{okay:false,reason:'nonlinear-penetration',time,dt,minimumGap,x,contact:final};
      const initialEnergy=physics.energy(x0,v0),finalEnergy=physics.energy(x,v),
        inputWork=solution.rows.reduce((sum,row,i)=>sum-(row.inputNormalVelocity??0)*solution.impulses[i],0),
        loadWork=-physics.parameters.load*(x[2]-x0[2]),dampingWork=-dt*dot(physics.parameters.damping,v.map(a=>a*a)),
        energyDefect=finalEnergy.total-initialEnergy.total-inputWork-loadWork-dampingWork;
      return{okay:true,state:{time,x,v,active:lastIds},diagnostic:{minimumGap,iterations:solution.iterations,
        projectionResidual:solution.residual,normalImpulse:Math.max(0,...solution.impulses),
        inputWork,loadWork,dampingWork,energyDefect,energy:finalEnergy,
        contacts:solution.rows.map((r,i)=>({id:r.id,kind:r.kind,impulse:solution.impulses[i],gap:r.gap})).filter(r=>r.impulse>1e-12)}};
    }
  }
  return{okay:false,reason:'nonlinear-iteration-limit',time,dt,x,v,solution};
}
