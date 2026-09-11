import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {makeSpringRackCoil} from './lib/spring-rack-coil.mjs';
import {renderedPrism} from './lib/crossed-rack-mesh-prisms.mjs';
const input='artifacts/review/081-interval-finer-dynamics.json',data=JSON.parse(fs.readFileSync(input)),
 candidate=makeSpringRackCandidate(data.geometry),u=candidate.root.userData,p=u.geometry,scale=p.source.scale,
 ys=data.rows.map(r=>r.x[0]),range=[Math.min(...ys),Math.max(...ys)],tolerance=1e-6,
 referenceSpan=p.spring.top-p.spring.bottom-2*p.spring.wireRadius,
 coil=makeSpringRackCoil({...p.spring,referenceSpan}),spans=[referenceSpan-range[1],referenceSpan-range[0]],
 radii=[coil.radiusAt(spans[1]),coil.radiusAt(spans[0])],outer=radii[1]+p.spring.wireRadius,
 inner=radii[0]*Math.cos(Math.PI*p.spring.turns/512)-p.spring.wireRadius;
const records=Object.entries(u.parts).map(([name,mesh])=>{
 const points=[],a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld));
 const box=new THREE.Box3().setFromPoints(points),local=box.clone(),family=u.families[name];
 if(family==='rack'){box.min.y+=range[0];box.max.y+=range[1];}
 if(family==='gear'){const R=Math.max(...points.map(v=>Math.hypot(v.x,v.y)));box.min.x=box.min.y=-R;box.max.x=box.max.y=R;}
 if(family==='spring'){
  box.min.set(p.spring.axisX-outer,p.spring.bottom+range[0],p.spring.axisZ-outer);
  box.max.set(p.spring.axisX+outer,p.spring.top,p.spring.axisZ+outer);
 }
 return{name,mesh,points,family,box,local};
}),byName=Object.fromEntries(records.map(r=>[r.name,r]));
const holeEdges=(mesh,plane='xy')=>{
 const g=mesh.geometry.clone();if(plane==='xz'){
  const a=g.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);a.setXYZ(i,x,-z,y);}
 }
 const prism=renderedPrism(g),xs=prism.points.map(v=>v[0]),ys=prism.points.map(v=>v[1]),
  limits=[[Math.min(...xs),Math.max(...xs)],[Math.min(...ys),Math.max(...ys)]];
 const edges=prism.boundary.filter(e=>!limits.some(([lo,hi],k)=>e.a[k]===e.b[k]&&(e.a[k]===lo||e.a[k]===hi)));
 g.dispose();if(!edges.length)throw Error('No actual hole boundary: '+mesh.name);return edges;
},holes={lower:holeEdges(u.parts.lowerRackGuide,'xz'),seat:holeEdges(u.parts.movingSpringSeat,'xz'),slot:holeEdges(u.parts.slottedRackRearWall)},
 insideMargin=(edges,points)=>Math.min(...points.map(v=>Math.min(...edges.map(e=>(v[0]-e.a[0])*e.normal[0]+(v[1]-e.a[1])*e.normal[1]))));
const bounds=[],pending=[];
for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
 const a=records[i],b=records[j];if(a.family===b.family)continue;
 const pair={a:a.name,b:b.name};let proof=null;
 for(const axis of ['x','y','z']){
  const gap=Math.max(b.box.min[axis]-a.box.max[axis],a.box.min[axis]-b.box.max[axis]);
  if(gap>=-tolerance){proof={method:'complete-range-axis-separation',axis,margin:gap};break;}
 }
 const gear=a.family==='gear'?a:b.family==='gear'?b:null,other=gear===a?b:a,
  spring=a.family==='spring'?a:b.family==='spring'?b:null,againstSpring=spring===a?b:a;
 if(!proof&&gear&&other.name==='fixedAxle'){
  const prism=renderedPrism(gear.mesh.geometry),bore=Math.min(...prism.boundary.map(e=>{
   const t=Math.max(0,Math.min(1,-(e.a[0]*e.d[0]+e.a[1]*e.d[1])/e.square));
   return Math.hypot(e.a[0]+t*e.d[0],e.a[1]+t*e.d[1]);
  })),axle=Math.max(...other.points.map(v=>Math.hypot(v.x,v.y)));
  if(bore>=axle)proof={method:'concentric-shaft-inside-rotating-bore',margin:bore-axle};
 }
 if(!proof&&spring&&againstSpring.family==='rack'){
  const gap=p.spring.bottom-againstSpring.local.max.y;
  if(gap>=-tolerance)proof={method:'correlated-rack-and-spring-bottom-plane',margin:gap};
 }
 if(!proof&&spring){
  const inside=Math.max(...againstSpring.points.map(v=>Math.hypot(v.x-p.spring.axisX,v.z-p.spring.axisZ)));
  if(inside<inner)proof={method:'complete-range-spring-inner-cylinder',margin:inner-inside};
 }
 const lower=a.name==='lowerRackGuide'?b:b.name==='lowerRackGuide'?a:null,
  seat=a.name==='movingSpringSeat'?b:b.name==='movingSpringSeat'?a:null;
 if(!proof&&lower){const margin=insideMargin(holes.lower,lower.points.map(v=>[v.x,-v.z]));
  if(margin>=-tolerance)proof={method:'actual-convex-lower-guide-hole-for-all-translation',margin};}
 if(!proof&&seat?.name==='fixedSlidingMandrel'){
  const margin=insideMargin(holes.seat,seat.points.map(v=>[v.x,-v.z]));
  if(margin>=-tolerance)proof={method:'actual-convex-seat-hole-around-fixed-mandrel',margin};
 }
 if(!proof&&[a.name,b.name].includes('slottedRackRearWall')&&[a.name,b.name].includes('fixedTravelStopPin')){
  const vertices=byName.fixedTravelStopPin.points.flatMap(v=>range.map(y=>[v.x,v.y-y])),margin=insideMargin(holes.slot,vertices);
  if(margin>=-tolerance)proof={method:'actual-pin-vertices-inside-convex-slot-at-both-travel-extrema',margin};
 }
 if(proof)bounds.push({...pair,...proof});else pending.push({...pair,primaryGearRack:!!gear&&/^rackTooth/.test(other.name)});
}
// The hollow moving tube overlaps the fixed mandrel even while it vacates
// the lower guide. Intersection length is piecewise concave in translation,
// hence its minimum over this interval occurs at a travel endpoint.
const rack=byName.rackLeftWall.local,mandrel=byName.fixedSlidingMandrel.local,
 guideEngagement=range.map(y=>Math.max(0,Math.min(rack.max.y+y,mandrel.max.y)-Math.max(rack.min.y+y,mandrel.min.y))),
 minimumMandrelEngagement=Math.min(...guideEngagement),issues=[];
if(minimumMandrelEngagement<=0)issues.push({kind:'lost-upper-guide',guideEngagement});
if(pending.some(pair=>!pair.primaryGearRack))issues.push({kind:'unbounded-hardware',pending});
const prefix=process.env.PROBE_PREFIX??'artifacts/review/081-refined-hardware-bounds',sources=['scripts/bound-spring-rack-hardware.mjs','scripts/lib/spring-rack-candidate.mjs',
 'scripts/lib/spring-rack-coil.mjs','scripts/lib/spring-rack-source.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs',input].map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report={movement:81,status:'continuous-range-hardware-bounds',productionChanged:false,mechanicsPassed:false,passed:issues.length===0,
 range,sourcePixelRange:range.map(y=>y*scale),tolerance,spans,radii,springInnerRadius:inner,springOuterRadius:outer,
 minimumMandrelEngagement,minimumMandrelEngagementPixels:minimumMandrelEngagement*scale,bounds,pending,issues,sources,
 qualification:'All stated hardware bounds cover every gear angle and every rack displacement in the recorded range, including correlated spring-end motion. Actual convex passage and slot boundaries are reconstructed from Float32 cap/side meshes. Shaft bore clearance uses distance to complete edges, and the spring inner cylinder includes centerline chord sag between adjacent mesh sections. Spring-radius extrema follow monotone constant-length helix quadrature; a 1e-6 mesh tolerance covers end-plane Float32 rounding. The seven primary gear/rack pairs and coil self-contact require separate checks. These bounds must be updated if playback exceeds this displacement range. This corrects two overestimated circular margins in the preserved first bounds report; the corrected margins still pass.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,bounded:bounds.length,pending,range,radii,minimumMandrelEngagementPixels:report.minimumMandrelEngagementPixels,issues});
if(!report.passed)process.exitCode=1;
