const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),
 dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 norm=a=>Math.hypot(...a),rotate=(v,angle)=>[Math.cos(angle)*v[0]-Math.sin(angle)*v[1],Math.sin(angle)*v[0]+Math.cos(angle)*v[1],v[2]],
 transform=(v,beta,angle,r=0,z=0)=>{const p=rotate([r+v[0],v[1]*Math.cos(beta)-v[2]*Math.sin(beta),v[1]*Math.sin(beta)+v[2]*Math.cos(beta)],angle);p[2]+=z;return p;};
const projectionGap=(P,W,n)=>Math.min(...P.map(v=>dot(v,n)))-Math.max(...W.map(v=>dot(v,n)));
const separatingAxis=(P,W)=>{
 let best={gap:-Infinity};
 const test=raw=>{const length=norm(raw);if(length<1e-12)return;const n=mul(raw,1/length),a=projectionGap(P.vertices,W.vertices,n),b=projectionGap(W.vertices,P.vertices,n);
  if(a>best.gap)best={gap:a,normal:n};if(b>best.gap)best={gap:b,normal:mul(n,-1)};
 };
 W.normals.forEach(test);P.normals.forEach(test);for(const p of P.edges)for(const w of W.edges)test(cross(p,w));return best;
};

export function makeOpposedArmPrimaryBounds(model,force,contact){
 const u=model.root.userData,p=u.geometry,N=contact.cells.length,segments=N/p.teeth,da=2*Math.PI/N,derivatives={};
 // Global analytic bounds for the circle-intersection linkage. Here rod length
 // exceeds arm radius, so its law-of-cosines expression increases with d.
 for(const key of ['upper','lower']){
  const a=p.arms[key],R=a.jointRadius,L=a.rodLength,Y=p.sourceSlider[1],xmin=p.sourceSlider[0]-force.parameters.stroke,xmax=p.sourceSlider[0]+force.parameters.stroke,
   dmin=Math.hypot(xmin,Y),dmax=Math.hypot(xmax,Y),C=d=>(d*d+R*R-L*L)/(2*R*d),cmax=Math.max(Math.abs(C(dmin)),Math.abs(C(dmax)));
  if(!(L>R&&xmin>0&&cmax<1))throw Error('Linkage derivative bound assumptions do not hold');
  const Fqmin=2*R*dmin*Math.sqrt(1-cmax*cmax),qx=2*(xmax+R)/Fqmin,qxx=(2+4*R*qx+2*R*dmax*qx*qx)/Fqmin,
   omega=2*Math.PI/force.parameters.period,xd=force.parameters.stroke*omega,xdd=force.parameters.stroke*omega*omega;
  derivatives[key]={qx,qxx,velocity:qx*xd,acceleration:qx*xdd+qxx*xd*xd};
 }
 // Establish the actual Float32 wheel's pitch symmetry defect by matching every
 // convex-cell vertex and connectivity after all 33 pitch rotations.
 const radii=[.108,p.innerRadius,1],coordinate=v=>{
  const radius=Math.hypot(v[0],v[1]),ri=radii.reduce((best,r,i)=>Math.abs(radius-r)<Math.abs(radius-radii[best])?i:best,0),
   a=(Math.atan2(v[1],v[0])-p.phase+4*Math.PI)%(2*Math.PI),ai=Math.round(a/da)%N;
  return{ri,ai,z:v[2]};
 },signature=ids=>ids.map(id=>[id.ri,id.ai,id.z].join(',')).sort().join('|'),lookup=new Map(),parts=[];
 for(const cell of contact.cells.flat()){
  const ids=cell.vertices.map(coordinate),signatureKey=signature(ids);if(lookup.has(signatureKey))throw Error('Duplicate cell signature');
  const item={...cell,ids};lookup.set(signatureKey,item);parts.push(item);
 }
 let symmetryError=0,symmetryVertexChecks=0;
 for(const cell of parts)for(let turn=0;turn<p.teeth;turn++){
  const shifted=cell.ids.map(id=>({...id,ai:(id.ai+turn*segments)%N})),other=lookup.get(signature(shifted));if(!other)throw Error('Missing pitch-equivalent cell');
  for(let i=0;i<shifted.length;i++){
   const id=shifted[i],index=other.ids.findIndex(v=>v.ri===id.ri&&v.ai===id.ai&&v.z===id.z);if(index<0)throw Error('Missing pitch-equivalent vertex');
   symmetryError=Math.max(symmetryError,norm(sub(cell.vertices[i],rotate(other.vertices[index],-turn*p.pitch))));symmetryVertexChecks++;
  }
 }
 const sample=(local,beta,angle,r)=>({vertices:local.vertices.map(v=>transform(v,beta,angle,r,p.pivotZ)),
  normals:local.normals.map(v=>transform(v,beta,angle)),edges:local.edges.map(v=>transform(v,beta,angle))});
 const parameters={derivatives,symmetryError,symmetryVertexChecks,cellCount:parts.length};
 const intervalImpl=(a,b,{tolerance=1e-6,maximumDepth=14}={},orbitAllowance=symmetryError)=>{
  const dt=b.time-a.time,velocity=b.x.map((v,i)=>(v-a.x[i])/dt),effectiveTolerance=tolerance-orbitAllowance-1e-11,
   xAt=time=>a.x.map((v,i)=>v+(time-a.time)*velocity[i]),stats={certifiedPairs:0,angularlyExcludedPairs:0,boxExcludedPairs:0,subdivisions:0,maximumDepth:0,minimumLowerBound:Infinity},failures=[],poseCache=new Map();
  if(effectiveTolerance<=0)throw Error('No positive Float32 margin');
  const cachedPose=(key,local,time)=>{
   const id=key+':'+local.id+':'+time;if(poseCache.has(id))return poseCache.get(id);
   const x=xAt(time),index=key==='upper'?1:2,result=sample(local,x[index],force.input(time).arms[key].psi-x[0],p.arms[key].pivotRadius);
   poseCache.set(id,result);return result;
  };
  const boundPair=(key,local,cell,lo,hi,depth)=>{
   const index=key==='upper'?1:2,r=p.arms[key].pivotRadius,rho=Math.max(...local.vertices.map(norm)),middle=(lo+hi)/2,
    P=cachedPose(key,local,middle),A=cachedPose(key,local,lo),B=cachedPose(key,local,hi),phid=derivatives[key].velocity+Math.abs(velocity[0]),betad=Math.abs(velocity[index]),
    acceleration=(r+rho)*(derivatives[key].acceleration+phid*phid)+2*rho*phid*betad+rho*betad*betad,curvature=acceleration*(hi-lo)**2/8;
   stats.maximumDepth=Math.max(stats.maximumDepth,depth);
   // Any fixed unit axis is a valid proof. Try the inexpensive face normals
   // before enumerating all SAT axes, retaining the same curvature bound.
   let certified=false;
   const tryAxis=raw=>{
    const length=norm(raw);if(length<1e-12)return false;const n=mul(raw,1/length);
    for(const sign of [1,-1]){const axis=mul(n,sign),lower=Math.min(projectionGap(A.vertices,cell.vertices,axis),projectionGap(B.vertices,cell.vertices,axis))-curvature;
     if(lower>=-effectiveTolerance){stats.certifiedPairs++;stats.minimumLowerBound=Math.min(stats.minimumLowerBound,lower-orbitAllowance-1e-11);return true;}}
    return false;
   };
   for(const n of cell.normals)if(tryAxis(n)){certified=true;break;}if(certified)return;
   for(const n of P.normals)if(tryAxis(n)){certified=true;break;}if(certified)return;
   const axis=separatingAxis(P,cell),lower=Math.min(projectionGap(A.vertices,cell.vertices,axis.normal),projectionGap(B.vertices,cell.vertices,axis.normal))-curvature;
   if(lower>=-effectiveTolerance){stats.certifiedPairs++;stats.minimumLowerBound=Math.min(stats.minimumLowerBound,lower-orbitAllowance-1e-11);return;}
   if(depth>=maximumDepth||axis.gap< -effectiveTolerance){failures.push({key,part:local.id,cell:cell.id,lo,hi,middle,depth,lower,gap:axis.gap,effectiveTolerance,
    reason:axis.gap< -tolerance?'interpolated-cell-overlap':'insufficient-continuous-orbit-margin',x:xAt(middle)});return;}
   stats.subdivisions++;boundPair(key,local,cell,lo,middle,depth+1);if(!failures.length)boundPair(key,local,cell,middle,hi,depth+1);
  };
  for(const [index,key]of ['upper','lower'].entries())for(const local of contact.pawls[key]){
   const mid=(a.time+b.time)/2,x=xAt(mid),angle=force.input(mid).arms[key].psi-x[0],r=p.arms[key].pivotRadius,rho=Math.max(...local.vertices.map(norm)),
    speed=(r+rho)*(derivatives[key].velocity+Math.abs(velocity[0]))+rho*Math.abs(velocity[index+1]),padding=speed*dt/2,
    P=sample(local,x[index+1],angle,r),angles=P.vertices.map(v=>angle+Math.atan2(Math.sin(Math.atan2(v[1],v[0])-angle),Math.cos(Math.atan2(v[1],v[0])-angle))),
    angularPadding=padding/(r-rho),first=Math.floor((Math.min(...angles)-angularPadding-p.phase)/da)-1,last=Math.floor((Math.max(...angles)+angularPadding-p.phase)/da)+1,
    minimum=[0,1,2].map(i=>Math.min(...P.vertices.map(v=>v[i]))-padding),maximum=[0,1,2].map(i=>Math.max(...P.vertices.map(v=>v[i]))+padding);
   if(!(r>rho)||last-first>=N)throw Error('Angular enclosure assumptions do not hold');
   let considered=0;
   for(let bucket=first;bucket<=last;bucket++)for(const cell of contact.cells[(bucket%N+N)%N]){
    considered++;if([0,1,2].some(i=>minimum[i]>cell.maximum[i]||cell.minimum[i]>maximum[i])){stats.boxExcludedPairs++;continue;}
    boundPair(key,local,cell,a.time,b.time,0);if(failures.length)return{passed:false,stats,failures};
   }
   stats.angularlyExcludedPairs+=parts.length-considered;
  }
  return{passed:true,stats,failures};
 };
 const interval=(a,b,options)=>intervalImpl(a,b,options),
  intervalAtOrientation=(a,b,turn,options)=>{
   if(!Number.isInteger(turn)||turn<0||turn>=p.teeth)throw Error('Invalid explicit pitch orientation');
   const shifted=row=>({...row,x:[row.x[0]-turn*p.pitch,...row.x.slice(1)]});
   return intervalImpl(shifted(a),shifted(b),options,0);
  };
 return{interval,intervalAtOrientation,parameters,qualification:'Convex-cell separation over the entire linear free-angle interpolation interval, with exact prescribed linkage motion. A fixed midpoint axis and global analytic second-derivative bound enclose each vertex-pair separation. Angular and box exclusions use global speed bounds. The default method reserves the measured Float32 symmetry defect to cover all 33 orientations. intervalAtOrientation instead checks one explicitly rotated actual wheel without that allowance; all 33 explicit orientations must pass to replace the default orbit certificate.'};
}
