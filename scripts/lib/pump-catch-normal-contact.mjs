import {makePumpCatchContact,rotate2,cross2} from './pump-catch-contact.mjs';

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],neg=a=>a.map(v=>-v),sub=(a,b)=>a.map((v,i)=>v-b[i]);
function inCone(n,normals){
  for(const a of normals)if(Math.hypot(...n.map((v,k)=>v-Math.max(0,dot(n,a))*a[k]))<1e-9)return true;
  for(let i=0;i<normals.length;i++)for(let j=i+1;j<normals.length;j++){const a=normals[i],b=normals[j],det=cross2(a,b);if(Math.abs(det)<1e-12)continue;
    if(cross2(n,b)/det>=-1e-10&&cross2(a,n)/det>=-1e-10)return true;}
  return false;
}
function boundaryNormals(prism){
  const map=new Map();for(const e of prism.boundary)for(const p of [e.a,e.b]){const key=p.join(','),normals=map.get(key)??[];normals.push(e.normal);map.set(key,normals);}
  return{vertex:i=>map.get(prism.points[i].join(',')),edge:(i,f)=>{const e=prism.boundary[i];return f*e.length<1e-12?map.get(e.a.join(',')):(1-f)*e.length<1e-12?map.get(e.b.join(',')):[e.normal];}};
}
export function makePumpCatchNormalContact(model){
  const base=makePumpCatchContact(model),normals=Object.fromEntries(['cam','hook','shaft','stop'].map(key=>[key,boundaryNormals(base[key])])),pivot=model.root.userData.geometry.pivot;
  const query=(q,camAngle,options)=>{
    const P=rotate2(pivot,q[0]),result=[];
    for(const c of base.query(q,camAngle,options)){
      if(c.kind==='pump-stop')continue;const f=c.feature,rotation=c.kind==='stop'?0:camAngle,
        hook=(f.pointOn==='hook'?normals.hook.vertex(f.vertex):normals.hook.edge(f.edge,f.fraction)).map(n=>neg(rotate2(n,q[1]))),
        obstacle=(f.pointOn==='hook'?normals[c.kind].edge(f.edge,f.fraction):normals[c.kind].vertex(f.vertex)).map(n=>rotate2(n,rotation));
      // At a face, use its exact normal instead of dividing a tiny separation
      // vector. At coincident corners, intersect both adjacent-face cones.
      const separation=sub(c.point,f.otherPoint),distance=Math.hypot(...separation);
      // A cone ray at a separated vertex pair can have zero projected gap
      // despite a finite tangential separation. It would create a force
      // across empty space. Only coincident corners admit multiple normals;
      // elsewhere retain the actual closest-point separation direction.
      // A projected edge-interior feature has one exact face normal. Dividing
      // its tiny gap vector amplifies roundoff and can incorrectly remove the
      // face from its own normal cone as the time step changes.
      const candidates=hook.length===1?hook:obstacle.length===1?obstacle:distance<1e-9?[...hook,...obstacle]:[c.normal];
      const choices=candidates.filter(n=>inCone(n,hook)&&inCone(n,obstacle));
      // Penetrating trial poses still require an escape constraint even if
      // their nearest feature has no admissible final reaction. Dropping it
      // can make a penetrated return stroke appear feasible. Only the final
      // common-boundary normal is eligible for force qualification.
      if(!choices.length&&c.gap<0)choices.push(c.normal);
      if(!choices.length)continue;
      const unique=choices.filter((n,i)=>!choices.slice(0,i).some(p=>dot(n,p)>1-1e-12));
      for(const normal of unique){
        const gap=dot(sub(c.point,f.otherPoint),normal),gradient=[cross2(P,normal),cross2(sub(c.point,P),normal)];
        result.push({...c,normal,gap,gradient,inputGradient:c.kind==='stop'?0:-cross2(c.point,normal)});
      }
    }
    return result;
  };
  const minimumRawGap=(q,camAngle)=>Math.min(0,...base.query(q,camAngle).filter(c=>c.kind!=='pump-stop').map(c=>c.gap));
  return{...base,query,minimumRawGap,qualification:'Complete finite prism boundaries and adjacent-face cones at coincident corners. Separated corners retain their nearest-point direction. Inadmissible penetrated trial features retain escape constraints and a separate raw-gap guard; final spatial normal checks and continuous edge-crossing checks remain required.'};
}
