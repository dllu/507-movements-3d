// Movement 76's finite-contact dynamics after pass 86: B and the holding
// click are plain plates in the wheel's plane. B's heel stops on the tappet
// web (alpha <= 0) and the tappet arm rests on one fixed pin. Adapted from
// jointed-tappet-dynamics-study.mjs, which other studies still fingerprint.
import{solveContactProjection,advanceJointedTappetStep}from'./jointed-tappet-dynamics-study.mjs';
export{solveContactProjection,advanceJointedTappetStep};
import{add,sub,rotate}from'./finite-plate-study.mjs';

const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>a[0]*b[1]-a[1]*b[0],
  clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function profileFrom(mesh){
  const shape=mesh.geometry.parameters.shapes[0],points=[];
  for(const p of shape.getPoints(1)){const q=[Math.fround(p.x),Math.fround(p.y)];if(!points.length||Math.hypot(...sub(q,points.at(-1)))>1e-12)points.push(q);}
  if(Math.hypot(...sub(points[0],points.at(-1)))<1e-12)points.pop();
  return points.map((a,i)=>{const b=points[(i+1)%points.length],d=sub(b,a);return{a,b,d,square:dot(d,d),index:i};});
}
// The tappet's exact (unrounded) outline, so its rest on the pin is exact.
function ringEdges(ring){
  const points=ring.slice(0,-1);
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

export function makeJointedTappet076Dynamics(candidate,{period=12,load=3,damping=[.08,.008,1,.003]}={}){
  const u=candidate.root.userData,p=u.geometry,density=1/u.masses.dog.volume,
    mass=Object.fromEntries(Object.entries(u.masses).map(([k,m])=>[k,{mass:density*m.volume,c:m.centroid.slice(0,2),I:density*m.polar}])),
    wheelEdges=profileFrom(u.parts.wheelBody),restEdges=ringEdges(u.outlines.bar[0][0]),
    restPin=sub(p.restPin,p.C),heelLever=p.heelRadius,strikeStart=p.strikeArmStart??p.B,barAxis=sub(p.end,strikeStart),barSquare=dot(barAxis,barAxis),omega=2*Math.PI/period;
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
    // B's heel bears flush on the radial end of the web's slot: a unilateral
    // stop at alpha = 0, measured as the heel tip's travel into the web.
    gaps.dogStop=-alpha*heelLever;
    if(gaps.dogStop<padding)rows.push({id:'dogStop',kind:'dogStop',gap:gaps.dogStop,J:[0,-heelLever,0,0]});
    // The tappet's own arm edge rests on the fixed rest pin.
    {const result=circleFeatures(restEdges,rotate(restPin,-q),p.restPinRadius,padding);gaps.restStop=result.gap;
      for(const f of result.rows){const normal=rotate(f.normal,q);rows.push({id:'restStop:'+f.index,kind:'restStop',gap:f.gap,J:[-cross(restPin,normal),0,0,0]});}}
    // One stud D on each of the driver's studCount spokes (evenly spaced).
    gaps.stud=Infinity;
    for(let k=0;k<(p.studCount??1);k++){
      const stud=rotate(p.studVector,-omega*time+2*Math.PI*k/(p.studCount??1)),local=rotate(sub(stud,p.C),-q),fraction=clamp(dot(sub(local,strikeStart),barAxis)/barSquare,0,1),
        center=add(strikeStart,barAxis.map(v=>v*fraction)),delta=sub(local,center),distance=Math.hypot(...delta),normal=rotate(delta.map(v=>v/distance),q),
        gap=distance-p.barRadius-p.studRadius;gaps.stud=Math.min(gaps.stud,gap);
      if(gap<padding)rows.push({id:k?'stud:'+k:'stud',kind:'stud',gap,J:[-cross(sub(stud,p.C),normal),0,0,0],
        inputNormalVelocity:dot(normal,[omega*stud[1],-omega*stud[0]]),point:stud,normal});
    }
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

