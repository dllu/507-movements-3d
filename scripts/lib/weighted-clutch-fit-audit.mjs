import source from './weighted-clutch-source.mjs';
import {weightedClutchFitPoints} from './weighted-clutch-source-fit.mjs';
import {THREE} from './weighted-clutch-distributed-candidate.mjs';
import {inspectWeightedClutchSolid} from './weighted-clutch-solid-audit.mjs';
import {nativePlateContours,signedArea,pointInsidePolygon} from './weighted-clutch-native-contours.mjs';
import {solidSurface,surfacePoints} from '../../tests/helpers/solid-surface.mjs';

export function clutchSourceProjection(model){
  const u=model.root.userData,L=u.linkage.parameters,world=(mesh,p=new THREE.Vector3())=>mesh.localToWorld(p.clone()),
    upper=u.source.bell.upperEnd.map((x,i)=>(i===0?x-u.source.origin[i]:u.source.origin[i]-x)/u.source.scale-L.G[i]),
    points={F:world(u.blocks.lever),A:world(u.parts.leverRodPin),G:world(u.blocks.bell),B:world(u.parts.bellRodPin),
      upper:world(u.blocks.bell,new THREE.Vector3(...upper,0)),E:world(u.gears.E),stud:world(u.parts.reversingStud)},
    projection=Object.entries(points).map(([name,p])=>{
      const pixel=[p.x*source.scale+source.origin[0],source.origin[1]-p.y*source.scale],delta=pixel.map((v,i)=>v-weightedClutchFitPoints[name][i]);
      return {name,pixel,delta,distance:Math.hypot(...delta)};
    }),errors=projection.map(p=>p.distance),E=points.E;
  function radialExtent(mesh){
    const p=mesh.geometry.attributes.position;let radius=0;
    for(let i=0;i<p.count;i++){
      const v=world(mesh,new THREE.Vector3().fromBufferAttribute(p,i));radius=Math.max(radius,Math.hypot(v.x-E.x,v.y-E.y));
    }
    return radius*source.scale;
  }
  const wheelRadius=radialExtent(u.parts.studWheelFront),studExtent=radialExtent(u.parts.reversingStud);
  return {projection,maximum:Math.max(...errors),mean:errors.reduce((s,v)=>s+v,0)/errors.length,
    rms:Math.sqrt(errors.reduce((s,v)=>s+v*v,0)/errors.length),wheelRadius,studExtent,
    studInsideMargin:wheelRadius-studExtent,pinionAxisOffset:u.gears.pinion.position.y-u.blocks.shaft.position.y};
}

function contour(mesh,name){
  const rings=nativePlateContours(mesh.geometry),outer=rings.reduce((a,b)=>Math.abs(signedArea(a))>Math.abs(signedArea(b))?a:b),
    selected=name==='studWheelFront'?rings:name==='slottedQuadrant'?
      rings.filter(r=>r===outer||!pointInsidePolygon([0,0],r)):[outer];
  return selected.map(r=>r.map(p=>{
    const v=mesh.localToWorld(new THREE.Vector3(...p,0));return[v.x*source.scale+source.origin[0],source.origin[1]-v.y*source.scale];
  }));
}
function directedContourDistance(a,b,spacing){
  const edges=b.flatMap(r=>r.map((p,i)=>[p,r[(i+1)%r.length]]));let weight=0,sum=0,square=0,maximum=0,samples=0;
  for(const ring of a)for(let i=0;i<ring.length;i++){
    const p=ring[i],q=ring[(i+1)%ring.length],length=Math.hypot(q[0]-p[0],q[1]-p[1]);if(length===0)continue;
    const count=Math.ceil(length/spacing),w=length/count;
    for(let k=0;k<count;k++){
      const t=(k+.5)/count,x=p[0]+t*(q[0]-p[0]),y=p[1]+t*(q[1]-p[1]);let distance=Infinity;
      for(const[u,v]of edges){
        const dx=v[0]-u[0],dy=v[1]-u[1],l2=dx*dx+dy*dy,
          f=l2?Math.max(0,Math.min(1,((x-u[0])*dx+(y-u[1])*dy)/l2)):0;
        distance=Math.min(distance,Math.hypot(x-u[0]-f*dx,y-u[1]-f*dy));
      }
      weight+=w;sum+=w*distance;square+=w*distance**2;maximum=Math.max(maximum,distance);samples++;
    }
  }
  return {perimeter:weight,weightedDistance:sum,weightedSquaredDistance:square,mean:sum/weight,rms:Math.sqrt(square/weight),
    sampledMaximum:maximum,maximumUpperBound:maximum+spacing/2,samples};
}

// These are registered native contours against the measured source model,
// not an image-recognition score against all of Brown's ink. Occlusion is not
// modeled. The quadrant slot and E openings are included; hidden pivot holes
// under the visible caps are omitted from the other outer contour checks.
export function clutchSourceContourComparison(model,reference,spacing=1.5){
  const names=['weightedLever','connectingRod','bellCrankG','slottedQuadrant','clutchShifterLever',
    'studWheelFront','reversingStud','leverRodPin','bellRodPin'],rows=[];
  for(const name of names){
    const a=contour(model.root.userData.parts[name],name),b=contour(reference.root.userData.parts[name],name);
    rows.push({name,candidateToSource:directedContourDistance(a,b,spacing),sourceToCandidate:directedContourDistance(b,a,spacing)});
  }
  const directions=rows.flatMap(r=>[r.candidateToSource,r.sourceToCandidate]),perimeter=directions.reduce((s,r)=>s+r.perimeter,0);
  return {spacing,rows,mean:directions.reduce((s,r)=>s+r.weightedDistance,0)/perimeter,
    rms:Math.sqrt(directions.reduce((s,r)=>s+r.weightedSquaredDistance,0)/perimeter),
    maximumUpperBound:Math.max(...directions.map(r=>r.maximumUpperBound)),samples:directions.reduce((s,r)=>s+r.samples,0)};
}

export function auditClutchSourceSolids(model){
  const u=model.root.userData,entries=Object.entries(u.parts),cache=new Map(),topologyCache=new Map(),topology=[],pairs=[],issues=[],
    family=name=>['shaft','pinion'].includes(u.families[name])?'output':u.families[name];
  for(const[name,m]of entries){
    if(!topologyCache.has(m.geometry))topologyCache.set(m.geometry,inspectWeightedClutchSolid(m.geometry));
    topology.push({name,...topologyCache.get(m.geometry)});
  }
  const topologyIssues=topology.filter(r=>r.components!==1||r.volume<=0||r.degenerate||r.wrongNormals||r.nonfinite||r.unmatchedEdges),
    boxes=new Map(entries.map(([name,m])=>{m.geometry.computeBoundingBox();return[name,m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)];}));
  const prepare=m=>{
    if(!cache.has(m.geometry))cache.set(m.geometry,{surface:solidSurface(m.geometry),points:surfacePoints(m.geometry)});
    return cache.get(m.geometry);
  };
  let independentPairs=0,separated=0,checks=0;
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const[an,a]=entries[i],[bn,b]=entries[j];if(family(an)===family(bn))continue;independentPairs++;
    if(!boxes.get(an).intersectsBox(boxes.get(bn))){separated++;continue;}
    for(const[fromName,from,toName,to]of [[an,a,bn,b],[bn,b,an,a]]){
      const src=prepare(from),dst=prepare(to),transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld),point=new THREE.Vector3();
      let gap=.01,inside=0,witness=null;
      for(const p of src.points){
        checks++;point.copy(p).applyMatrix4(transform);if(gap>0&&dst.surface.box.distanceToPoint(point)>=gap)continue;
        const d=dst.surface.signedDistance(point,.01);if(d< -1e-6)inside++;
        if(d<gap){gap=d;witness=point.clone().applyMatrix4(to.matrixWorld).toArray();}
      }
      const row={from:fromName,to:toName,gap,inside,checks:src.points.length,witness};pairs.push(row);if(inside)issues.push(row);
    }
  }
  return {topology,topologyIssues,independentPairs,separated,checks,pairs,issues};
}
