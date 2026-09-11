import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {makeSpringRackContact} from './lib/spring-rack-contact-study.mjs';
import {renderedPrism} from './lib/crossed-rack-mesh-prisms.mjs';
const input='artifacts/review/081-interval-finer-dynamics.json',data=JSON.parse(fs.readFileSync(input)),candidate=makeSpringRackCandidate(data.geometry),
 u=candidate.root.userData,p=u.geometry,contact=makeSpringRackContact(candidate),prism=renderedPrism(u.parts.workingGear.geometry),
 faceRadius=p.source.circles.wheelInner.radius/p.source.scale,outer=prism.boundary.filter(e=>Math.hypot(...e.a)>faceRadius+1e-3),
 cross=(a,b)=>a[0]*b[1]-a[1]*b[0],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),issues=[];
let maximumEndpointDifference=0;
for(const edge of contact.gear.edges){
 const error=Math.min(...outer.map(other=>Math.max(distance(edge.a,other.a),distance(edge.b,other.b))));
 maximumEndpointDifference=Math.max(maximumEndpointDifference,error);
}
const nonpositiveFans=contact.gear.edges.filter(e=>cross(e.a,e.b)<=0),
 nonpositiveRadius=Math.max(0,...nonpositiveFans.flatMap(e=>[Math.hypot(...e.a),Math.hypot(...e.b)])),
 rackDistance=Math.min(...contact.racks.flatMap(r=>r.points.map(v=>Math.abs(v[0])))),
 excludedCoreRadius=Math.max(nonpositiveRadius,faceRadius),excludedCoreMargin=rackDistance-excludedCoreRadius,
 rackComparisons=contact.racks.map((rack,i)=>{
  const actual=renderedPrism(u.parts['rackTooth'+i].geometry),maximumEndpointDifference=Math.max(...rack.edges.map(edge=>
   Math.min(...actual.boundary.map(other=>Math.max(distance(edge.a,other.a),distance(edge.b,other.b))))));
  return{tooth:i,edges:rack.edges.length,actualEdges:actual.boundary.length,maximumEndpointDifference};
 });
if(outer.length!==contact.gear.edges.length||maximumEndpointDifference>1e-12||excludedCoreMargin<=0||rackComparisons.some(r=>r.maximumEndpointDifference>1e-12||r.edges!==r.actualEdges))
 issues.push({kind:'rendered-profile-correspondence'});
const prefix='artifacts/review/081-contact-representation',sources=['scripts/check-spring-rack-contact-representation.mjs','scripts/lib/spring-rack-contact-study.mjs',
 'scripts/lib/spring-rack-candidate.mjs','scripts/lib/spring-rack-source.mjs','scripts/lib/spring-rack-coil.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs',input].map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report={movement:81,status:'finite-contact-profile-to-rendered-mesh-correspondence',productionChanged:false,mechanicsPassed:false,passed:issues.length===0,
 gearBoundaryEdges:outer.length,maximumEndpointDifference,rackComparisons,nonpositiveFans:nonpositiveFans.map(e=>({a:e.a,b:e.b,cross:cross(e.a,e.b)})),
 nonpositiveRadius,faceRadius,rackDistance,excludedCoreRadius,excludedCoreMargin,issues,sources,
 argument:['Each participating gear fan is a convex triangle and each rack tooth is a convex trapezoid. Their vertical-translation collision set is an interval.',
  'For a convex pair, the interval extrema solve equal-x vertex/edge constraints. Both vertex/edge directions are enumerated. The union over participating fans and rack teeth therefore describes the forbidden vertical translations.',
  'Three nominally radial root edges acquire tiny negative fan areas after Float32 rounding. Those fans and the filled face hole are wholly inside the excluded core, which no rack point can reach at any gear angle or rack height.',
  'Outside that core, gear radial order is positive and all contour edges match the complete rendered outer boundary to the reported error. Rack contours match their rendered boundaries exactly.',
  'Selecting a rack height outside the interval union enforces primary clearance at each evaluated angle. The playback guard is 2e-7, compared with endpoint differences below 1e-12. Numerical screening and continuous correction/error bounds remain distinct requirements.'],
 qualification:'This establishes the geometric correspondence used by exact vertical obstacle projection, including actual cap/side validation and the inaccessible core exception. It does not bound playback correction between sampled times, local coil folding or total continuum error.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,gearBoundaryEdges:outer.length,maximumEndpointDifference,nonpositiveFans:nonpositiveFans.length,excludedCoreMargin,rackComparisons,issues});
if(!report.passed)process.exitCode=1;
