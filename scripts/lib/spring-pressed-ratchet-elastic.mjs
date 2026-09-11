import { makeSourceSpring, makeSourceRatchet } from './spring-pressed-ratchet-source.mjs';
import { ratchetFeatureDistances } from './ratchet-feature-distance.mjs';
import { taperedSpringContacts } from './tapered-spring-contact.mjs';

const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1];

function segmentDistance(a,b,c,d){
  const u=sub(b,a),v=sub(d,c),w=sub(a,c),aa=dot(u,u),bb=dot(u,v),cc=dot(v,v),dd=dot(u,w),ee=dot(v,w),den=aa*cc-bb*bb;
  let s=den>1e-20?Math.max(0,Math.min(1,(bb*ee-cc*dd)/den)):0;
  let t=(bb*s+ee)/cc;
  if(t<0){t=0;s=Math.max(0,Math.min(1,-dd/aa));}
  else if(t>1){t=1;s=Math.max(0,Math.min(1,(bb-dd)/aa));}
  const first=[a[0]+s*u[0],a[1]+s*u[1]],second=[c[0]+t*v[0],c[1]+t*v[1]];
  return{s,t,first,second,delta:sub(first,second)};
}

function endpointContacts(a,b,c,d){
  const u=sub(b,a),v=sub(d,c),ac=sub(c,a),ad=sub(d,a),ca=sub(a,c),cb=sub(b,c);
  const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
  if(cross(u,ac)*cross(u,ad)<-1e-16&&cross(v,ca)*cross(v,cb)<-1e-16)
    throw new Error('Spring centerlines crossed');
  const projection=(p,root,edge)=>Math.max(0,Math.min(1,dot(sub(p,root),edge)/dot(edge,edge)));
  return[[0,projection(a,c,v)],[1,projection(b,c,v)],[projection(c,a,u),0],[projection(d,a,u),1]].map(([s,t],endpoint)=>{
    const first=[a[0]+s*u[0],a[1]+s*u[1]],second=[c[0]+t*v[0],c[1]+t*v[1]];
    return{s,t,endpoint,first,second,delta:sub(first,second)};
  });
}

function freeStrongSpring(segments,clampY){
  if(clampY===null)return makeSourceSpring('strong',segments);
  const full=makeSourceSpring('strong',2048),level=(589.3988765107598-clampY)/267.22413244806916;
  const crossing=full.points.findIndex(point=>point[1]>=level);
  if(crossing<1||crossing>=full.points.length-1)throw new Error('Clamp does not intersect the fixed source leaf');
  const a=full.points[crossing-1],b=full.points[crossing],t=(level-a[1])/(b[1]-a[1]);
  const points=[[a[0]+t*(b[0]-a[0]),level],...full.points.slice(crossing)],cumulative=[0];
  for(let i=1;i<points.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(...sub(points[i],points[i-1])));
  const sampled=[],length=cumulative.at(-1);let cursor=1;
  for(let i=0;i<=segments;i++){
    const target=length*i/segments;while(cursor<cumulative.length-1&&cumulative[cursor]<target)cursor++;
    const u=(target-cumulative[cursor-1])/(cumulative[cursor]-cumulative[cursor-1]);
    sampled.push(points[cursor-1].map((v,axis)=>v+u*(points[cursor][axis]-v)));
  }
  const lengths=[],angles=[];
  for(let i=1;i<sampled.length;i++){const edge=sub(sampled[i],sampled[i-1]);lengths.push(Math.hypot(...edge));angles.push(Math.atan2(edge[1],edge[0]));}
  return{kind:'strong',points:sampled,lengths,angles,width:full.width,length:lengths.reduce((a,b)=>a+b,0),
    clampY,fixedLowerPoints:full.points.slice(0,crossing)};
}

export function makeElasticRatchetStudy({segments=24,catchStiffness=1,strongStiffness=6,load=.002,
  penalty=1000,strongTipPixels=24,strongRootPixels=32,strongClampY=890,springContactMode='endpoints',
  wheelContactMode='full-leaf',wheelFeatureMode='nearest'}={}){
  const ratchet=makeSourceRatchet(),B=makeSourceSpring('catch',segments),C=freeStrongSpring(segments,strongClampY);
  const rods=[B,C],offsets=[0,segments-1],qIndex=2*(segments-1),size=qIndex+1;
  B.widths=B.points.map(()=>B.width);
  C.widths=C.points.map((_,i)=>(strongRootPixels+(strongTipPixels-strongRootPixels)*i/segments)/267.22413244806916);
  B.stiffness=catchStiffness;C.stiffness=strongStiffness;
  const initial=Array(size).fill(0);initial[qIndex]=-.0075;
  const multipliers=new Map();
  const evaluate=(x,input,{details=false}={})=>{
    const gradient=Array(size).fill(0),q=x[qIndex],cs=Math.cos(q),sn=Math.sin(q);
    let energy=-load*q,bendingEnergy=0,penaltyEnergy=0,maximumPenetration=0;
    gradient[qIndex]=-load;
    const geometries=rods.map((rod,k)=>{
      const angle=k===0?input:0,root=k===0?rotate(rod.points[0],input):rod.points[0];
      const points=[[...root]],edges=[],forces=Array.from({length:segments+1},()=>[0,0]);
      const deflections=Array.from({length:segments},(_,i)=>i===0?0:x[offsets[k]+i-1]);
      for(let i=0;i<segments;i++){
        const theta=rod.angles[i]+angle+deflections[i],edge=[rod.lengths[i]*Math.cos(theta),rod.lengths[i]*Math.sin(theta)];
        edges.push(edge);points.push([points[i][0]+edge[0],points[i][1]+edge[1]]);
        if(i===0)continue;
        const delta=deflections[i]-deflections[i-1],width=(rod.widths[i]+rod.widths[i-1])/2;
        const stiffness=rod.stiffness*(width/rod.width)**3/((rod.lengths[i]+rod.lengths[i-1])/2);
        bendingEnergy+=.5*stiffness*delta*delta;
        gradient[offsets[k]+i-1]+=stiffness*delta;
        if(i>1)gradient[offsets[k]+i-2]-=stiffness*delta;
      }
      return{points,edges,forces,deflections};
    });
    const contacts=[],gaps=[];
    const reaction=(key,gap)=>{
      const lambda=multipliers.get(key)??0,force=Math.max(0,lambda-penalty*gap);
      penaltyEnergy+=(force*force-lambda*lambda)/(2*penalty);
      maximumPenetration=Math.max(maximumPenetration,-gap);
      gaps.push({key,gap,force});return force;
    };
    for(let k=0;k<2;k++){
      const geometry=geometries[k],rod=rods[k];
      for(let sample=0;sample<=segments*2;sample++){
        if(wheelContactMode==='tips'&&sample!==segments*2)continue;
        const i=Math.min(segments-1,Math.floor(sample/2)),fraction=sample/2-i;
        const a=geometry.points[i],b=geometry.points[i+1],point=[a[0]+fraction*(b[0]-a[0]),a[1]+fraction*(b[1]-a[1])];
        const width=rod.widths[i]+fraction*(rod.widths[i+1]-rod.widths[i]);
        const key=`r${k}:${sample}`;
        if(Math.hypot(...point)>1+width/2&&!multipliers.has(key)
          &&(wheelFeatureMode==='nearest'||!ratchet.features.some((_,index)=>multipliers.has(key+':'+index))))continue;
        const local=[point[0]*cs+point[1]*sn,-point[0]*sn+point[1]*cs];
        if(wheelFeatureMode==='all'&&Math.hypot(...local)<ratchet.radiusAt(Math.atan2(local[1],local[0])))
          throw new Error('Spring tip center entered wheel');
        const distances=wheelFeatureMode==='all'?ratchetFeatureDistances(ratchet,local):[ratchet.closest(local)];
        for(const nearest of distances){
        const contactKey=key+(nearest.index===undefined?'':':'+nearest.index);
        const gap=(nearest.signedDistance??nearest.distance)-width/2,force=reaction(contactKey,gap);
        if(force===0)continue;
        if(!nearest.normal)throw new Error('Undefined tooth normal');
        const normal=[nearest.normal[0]*cs-nearest.normal[1]*sn,nearest.normal[0]*sn+nearest.normal[1]*cs];
        const derivative=normal.map(v=>-force*v);
        for(let axis=0;axis<2;axis++){geometry.forces[i][axis]+=(1-fraction)*derivative[axis];geometry.forces[i+1][axis]+=fraction*derivative[axis];}
        gradient[qIndex]-=-point[1]*derivative[0]+point[0]*derivative[1];
        if(details)contacts.push({kind:k===0?'B-A':'C-A',sample,featureIndex:nearest.index,gap,force,normal,point,feature:nearest.feature,tooth:nearest.tooth});
        }
      }
    }
    const first=geometries[0],second=geometries[1];
    for(let i=0;i<segments;i++)for(let j=0;j<segments;j++){
      const radii=[B.widths[i],B.widths[i+1],C.widths[j],C.widths[j+1]].map(w=>w/2);
      const radius=springContactMode==='tapered'
        ?Math.max(radii[0],radii[1])+Math.max(radii[2],radii[3]):radii.reduce((a,b)=>a+b,0)/2;
      const a=first.points[i],b=first.points[i+1],c=second.points[j],d=second.points[j+1];
      const dx=Math.max(0,Math.min(a[0],b[0])-Math.max(c[0],d[0]),Math.min(c[0],d[0])-Math.max(a[0],b[0]));
      const dy=Math.max(0,Math.min(a[1],b[1])-Math.max(c[1],d[1]),Math.min(c[1],d[1])-Math.max(a[1],b[1]));
      const pairKey=`s:${i}:${j}`;
      if(dx*dx+dy*dy>radius*radius&&!multipliers.has(pairKey)
        &&![0,1,2,3].some(endpoint=>multipliers.has(pairKey+':'+endpoint)))continue;
      const hits=springContactMode==='single-witness'
        ?[segmentDistance(first.points[i],first.points[i+1],second.points[j],second.points[j+1])]
        :springContactMode==='tapered'?taperedSpringContacts(a,b,c,d,radii):endpointContacts(a,b,c,d);
      for(const hit of hits){
      const key=`s:${i}:${j}`+(hit.endpoint===undefined?'':`:${hit.endpoint}`);
      const distance=Math.hypot(...hit.delta),gap=distance-(hit.radius??radius),force=reaction(key,gap);
      if(force===0)continue;
      if(distance<1e-12)throw new Error('Spring centerlines crossed');
      const normal=hit.delta.map(v=>v/distance),derivative=normal.map(v=>-force*v);
      for(let axis=0;axis<2;axis++){
        first.forces[i][axis]+=(1-hit.s)*derivative[axis];first.forces[i+1][axis]+=hit.s*derivative[axis];
        second.forces[j][axis]-=(1-hit.t)*derivative[axis];second.forces[j+1][axis]-=hit.t*derivative[axis];
      }
      if(details)contacts.push({kind:'B-C',i,j,endpoint:hit.endpoint,gap,force,normal,first:hit.first,second:hit.second});
      }
    }
    for(let k=0;k<2;k++){
      const geometry=geometries[k],sum=[0,0];
      for(let i=segments-1;i>=1;i--){
        sum[0]+=geometry.forces[i+1][0];sum[1]+=geometry.forces[i+1][1];
        const edge=geometry.edges[i];gradient[offsets[k]+i-1]+=-edge[1]*sum[0]+edge[0]*sum[1];
      }
    }
    energy+=bendingEnergy+penaltyEnergy;
    return{energy,gradient,bendingEnergy,penaltyEnergy,maximumPenetration,gaps,
      ...(details?{input,q,geometries:geometries.map(({forces,...row})=>row),contacts}:{})};
  };
  const updateMultipliers=state=>{
    for(const {key,gap}of state.gaps){const next=Math.max(0,(multipliers.get(key)??0)-penalty*gap);if(next>0)multipliers.set(key,next);else multipliers.delete(key);}
  };
  return{ratchet,rods,initial,size,qIndex,evaluate,updateMultipliers,multipliers,
    parameters:{segments,catchStiffness,strongStiffness,load,penalty,strongTipPixels,strongRootPixels,strongClampY,springContactMode,wheelContactMode,wheelFeatureMode}};
}
