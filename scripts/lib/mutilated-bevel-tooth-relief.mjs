import * as THREE from 'three';
import clipping from 'polygon-clipping';

export function toothChart(geometry){
  const p=geometry.attributes.position,n=p.count/6;
  if(!Number.isInteger(n))throw new Error('Expected unmodified ruled bevel tooth');
  return Array.from({length:n},(_,i)=>[p.getX(n+i)/p.getZ(n+i),p.getY(n+i)/p.getZ(n+i)]);
}
const area=ring=>Math.abs(ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-a[1]*b[0];},0))/2;
const multiArea=polygons=>polygons.reduce((sum,rings)=>sum+area(rings[0])-rings.slice(1).reduce((s,r)=>s+area(r),0),0);
const bounds=ring=>[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
const snap=point=>point.map(v=>Math.round(v*1e9)/1e9);
const snapPolygons=polygons=>polygons.map(rings=>rings.map(ring=>ring.map(snap)));

// Boolean cuts can leave nearly coincident vertices whose inner and outer
// copies collapse differently after Float32 conversion. Remove only features
// below this explicit chart tolerance, before triangulating either cap. The
// contact solver must use this same cleaned boundary, not the raw cut polygon.
function cleanChartRing(raw){
  const ring=raw.map(p=>[...p]);
  if(Math.hypot(ring[0][0]-ring.at(-1)[0],ring[0][1]-ring.at(-1)[1])<1e-12)ring.pop();
  let changed=true;
  while(changed&&ring.length>3){
    changed=false;
    for(let i=0;i<ring.length;i++){
      const a=ring[(i+ring.length-1)%ring.length],b=ring[i],c=ring[(i+1)%ring.length],dx=c[0]-a[0],dy=c[1]-a[1],square=dx*dx+dy*dy;
      const t=square?Math.max(0,Math.min(1,((b[0]-a[0])*dx+(b[1]-a[1])*dy)/square)):0;
      const distance=Math.hypot(b[0]-a[0]-t*dx,b[1]-a[1]-t*dy);
      if(distance<1e-7){ring.splice(i,1);changed=true;break;}
    }
  }
  return ring;
}

function projectPolygon(points){
  const clipped=[];const level=1e-5;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],inside=a.z>=level,next=b.z>=level;
    if(inside)clipped.push(a);
    if(inside!==next){const t=(level-a.z)/(b.z-a.z);clipped.push(a.clone().lerp(b,t));}
  }
  return clipped.map(p=>snap([p.x/p.z,p.y/p.z]));
}

export function conicalChartGeometry(polygons,{outerDistance,pitchConeAngle,innerScale}){
  polygons=polygons.map(rings=>rings.map(cleanChartRing));
  const tangent=Math.tan(pitchConeAngle),end=outerDistance/Math.cos(pitchConeAngle)**2,positions=[],normals=[];
  const point=(p,scale)=>{const z=end/(1+tangent*Math.hypot(...p))*scale;return new THREE.Vector3(p[0]*z,p[1]*z,z);};
  const capNormal=(p,sign)=>new THREE.Vector3(tangent*p.x/Math.hypot(p.x,p.y),tangent*p.y/Math.hypot(p.x,p.y),1).normalize().multiplyScalar(sign);
  const emit=(vertices,ns)=>{
    let [a,b,c]=vertices,[na,nb,nc]=ns;
    const cross=b.clone().sub(a).cross(c.clone().sub(a));if(cross.lengthSq()<1e-22)return;
    if(cross.dot(na.clone().add(nb).add(nc))<0){[b,c]=[c,b];[nb,nc]=[nc,nb];}
    for(const p of [a,b,c])positions.push(...p.toArray());for(const n of [na,nb,nc])normals.push(...n.toArray());
  };
  for(const raw of polygons){
    const rings=raw.map(ring=>ring.filter((p,i)=>i===0||Math.hypot(p[0]-ring[i-1][0],p[1]-ring[i-1][1])>1e-12));
    for(const ring of rings)if(Math.hypot(ring[0][0]-ring.at(-1)[0],ring[0][1]-ring.at(-1)[1])<1e-12)ring.pop();
    // polygon-clipping returns CCW outer rings and CW holes.
    const points=rings.flat(),triangles=THREE.ShapeUtils.triangulateShape(rings[0].map(p=>new THREE.Vector2(...p)),rings.slice(1).map(r=>r.map(p=>new THREE.Vector2(...p))));
    for(const scale of [innerScale,1])for(const triangle of triangles){
      const vertices=triangle.map(i=>point(points[i],scale));emit(vertices,vertices.map(p=>capNormal(p,scale===1?1:-1)));
    }
    for(const ring of rings)for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],innerA=point(a,innerScale),innerB=point(b,innerScale),outerA=point(a,1),outerB=point(b,1);
      const normal=new THREE.Vector3(a[0],a[1],1).cross(new THREE.Vector3(b[0],b[1],1)).normalize().negate();
      emit([innerA,innerB,outerB],[normal,normal,normal]);emit([innerA,outerB,outerA],[normal,normal,normal]);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.userData={profile:'relieved-back-cone-involute',polygons,outerDistance,pitchConeAngle,innerScale};return geometry;
}

export function relieveSectorEnds(model,{steps=720,endTeeth=1}={}){
  const{blocks:b,geometry:p,stateAtTime}=model.root.userData,C=b.driverC,original=C.userData.toothMeshes[0].geometry;
  const initial=toothChart(original).map(snap),initialArea=area(initial),initialBounds=bounds(initial),rows=[];
  const last=C.userData.installedToothIndices.at(-1),endIndices=[...new Set(Array.from({length:endTeeth},(_,i)=>[i,last-i]).flat())].sort((a,b)=>a-b),profiles=new Map(endIndices.map(index=>[index,[[initial]]]));
  const sourcePoints=new Map();
  for(const gear of [b.gearA,b.gearB])for(const tooth of gear.userData.toothMeshes){
    const a=tooth.geometry.attributes.position,n=a.count/6;
    sourcePoints.set(tooth,Array.from({length:n},(_,i)=>new THREE.Vector3().fromBufferAttribute(a,n+i)));
  }
  let cuts=0;
  for(let sample=0;sample<=steps;sample++){
    const coordinate=sample/steps,time=(coordinate-p.initialCyclePhase)*p.period;model.update(time);model.root.updateMatrixWorld(true);const state=stateAtTime(time);
    for(const index of endIndices){
      const tooth=C.userData.toothMeshes.find(t=>t.userData.index===index),inverse=tooth.matrixWorld.clone().invert();
      for(const [gear,indexing]of [[b.gearA,state.indexingA],[b.gearB,state.indexingB]]){
        if(indexing)continue;
        for(const source of gear.userData.toothMeshes){
          const transform=inverse.clone().multiply(source.matrixWorld),poly=projectPolygon(sourcePoints.get(source).map(p=>p.clone().applyMatrix4(transform)));
          if(poly.length<3)continue;const box=bounds(poly);
          if(box[2]<initialBounds[0]||box[0]>initialBounds[2]||box[3]<initialBounds[1]||box[1]>initialBounds[3])continue;
          const current=profiles.get(index),next=snapPolygons(clipping.difference(current,[poly]));
          if(multiArea(current)-multiArea(next)>1e-14){cuts++;profiles.set(index,next);}
        }
      }
    }
  }
  for(const index of endIndices){
    const polygons=profiles.get(index),tooth=C.userData.toothMeshes.find(t=>t.userData.index===index);
    rows.push({index,initialArea,retainedArea:multiArea(polygons),retainedFraction:multiArea(polygons)/initialArea,polygons});
    tooth.geometry=conicalChartGeometry(polygons,{outerDistance:C.userData.outerDistance,pitchConeAngle:C.userData.pitchConeAngle,innerScale:C.userData.innerDistance/C.userData.outerDistance});
  }
  model.update(0);model.root.updateMatrixWorld(true);
  return{steps,endTeeth,cuts,rows,qualification:'Sampled angular-envelope relief of C sector-end teeth against stationary output teeth during ideal dwell. Gnomonic projection preserves each actual ruled side plane. No output-body cutting or between-sample sweep bound is included; full surface clearance and remaining drive contact must be checked independently.'};
}

function hull(points){
  const sorted=points.map(snap).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).filter((p,i,a)=>i===0||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  const a=half(sorted),b=half([...sorted].reverse());a.pop();b.pop();return [...a,...b];
}
function clipBox(polygon,radius){
  let out=polygon;
  for(const [axis,sign]of [[0,1],[0,-1],[1,1],[1,-1]]){
    const next=[];
    for(let i=0;i<out.length;i++){
      const a=out[i],b=out[(i+1)%out.length],da=radius-sign*a[axis],db=radius-sign*b[axis];
      if(da>=0)next.push(a);
      if((da>=0)!==(db>=0)){const t=da/(da-db);next.push(a.map((v,j)=>v+t*(b[j]-v)));}
    }
    out=next;
  }
  return out;
}

export function relieveSectorEndsContinuous(model,{steps=360,endTeeth=2}={}){
  const{blocks:b,geometry:p,stateAtTime}=model.root.userData,C=b.driverC;
  const initial=toothChart(C.userData.toothMeshes[0].geometry).map(snap),initialArea=area(initial),initialBounds=bounds(initial),
    last=C.userData.installedToothIndices.at(-1),endIndices=[...new Set(Array.from({length:endTeeth},(_,i)=>[i,last-i]).flat())].sort((a,b)=>a-b),
    profiles=new Map(endIndices.map(index=>[index,[[initial]]])),sourceData=new Map();
  const maximumRadius=Math.max(...initial.map(p=>Math.hypot(...p))),clipRadius=maximumRadius*2;
  for(const gear of [b.gearA,b.gearB])for(const tooth of gear.userData.toothMeshes){
    const a=tooth.geometry.attributes.position,n=a.count/6,points=Array.from({length:n},(_,i)=>new THREE.Vector3().fromBufferAttribute(a,n+i));
    sourceData.set(tooth,{points,triangles:THREE.ShapeUtils.triangulateShape(toothChart(tooth.geometry).map(p=>new THREE.Vector2(...p)),[])});
  }
  const shift=p.shiftTeeth/p.driverTeeth,knots=[...Array.from({length:steps+1},(_,i)=>i/steps),.5-shift,1-shift].filter(u=>u>=0&&u<=1).sort((a,b)=>a-b),rows=[];
  let cuts=0,maximumMargin=0;
  for(let interval=0;interval+1<knots.length;interval++){
    const first=knots[interval],last=knots[interval+1],delta=2*Math.PI*(last-first);if(delta<1e-12)continue;
    const time=(first-p.initialCyclePhase)*p.period,mid=stateAtTime(((first+last)/2-p.initialCyclePhase)*p.period);
    model.update(time);model.root.updateMatrixWorld(true);
    const c=Math.cos(delta),s=Math.sin(delta);
    // Each source point rotates about the chart origin during dwell. Its arc
    // differs from the endpoint chord by at most R*(1-cos(delta/2)). Source
    // triangles are clipped only outside twice the candidate's maximum radius;
    // removed points cannot rotate into the candidate footprint.
    const margin=Math.SQRT2*clipRadius*(1-Math.cos(delta/2))+2e-8;maximumMargin=Math.max(maximumMargin,margin);
    for(const index of endIndices){
      const tooth=C.userData.toothMeshes.find(t=>t.userData.index===index),inverse=tooth.matrixWorld.clone().invert();
      for(const [gear,indexing]of [[b.gearA,mid.indexingA],[b.gearB,mid.indexingB]]){
        if(indexing)continue;
        for(const source of gear.userData.toothMeshes){
          const data=sourceData.get(source),transform=inverse.clone().multiply(source.matrixWorld),points=data.points.map(p=>p.clone().applyMatrix4(transform));
          const coarse=projectPolygon(points);if(coarse.length<3)continue;
          const coarseBox=bounds(coarse),motion=2*Math.SQRT2*clipRadius*Math.sin(delta/2);
          if(coarseBox[2]+motion<initialBounds[0]||coarseBox[0]-motion>initialBounds[2]||coarseBox[3]+motion<initialBounds[1]||coarseBox[1]-motion>initialBounds[3])continue;
          for(const triangle of data.triangles){
            const poly=clipBox(projectPolygon(triangle.map(i=>points[i])),clipRadius);if(poly.length<3)continue;
            const endpoints=[...poly,...poly.map(p=>[p[0]*c-p[1]*s,p[0]*s+p[1]*c])];
            const swept=hull(endpoints.flatMap(p=>[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y])=>[p[0]+x*margin,p[1]+y*margin]))),box=bounds(swept);
            if(box[2]<initialBounds[0]||box[0]>initialBounds[2]||box[3]<initialBounds[1]||box[1]>initialBounds[3])continue;
            const current=profiles.get(index),next=snapPolygons(clipping.difference(current,[swept]));
            if(multiArea(current)-multiArea(next)>1e-14){cuts++;profiles.set(index,next);}
          }
        }
      }
    }
  }
  for(const index of endIndices){
    const polygons=profiles.get(index),tooth=C.userData.toothMeshes.find(t=>t.userData.index===index);
    rows.push({index,initialArea,retainedArea:multiArea(polygons),retainedFraction:multiArea(polygons)/initialArea,polygons});
    tooth.geometry=conicalChartGeometry(polygons,{outerDistance:C.userData.outerDistance,pitchConeAngle:C.userData.pitchConeAngle,innerScale:C.userData.innerDistance/C.userData.outerDistance});
  }
  model.update(0);model.root.updateMatrixWorld(true);
  return{steps,endTeeth,cuts,maximumMargin,rows,qualification:'Conservative angular sweep of each output-tooth triangle during dwell. Endpoint convex hulls are expanded by an analytic circular-arc sagitta bound and 2e-8 chart roundoff allowance. Intervals split exactly at dwell boundaries. The outer clipping box removes only points farther from the chart origin than the complete candidate. Output-body interference and remaining drive contact are checked separately.'};
}

export function applySectorRelief(model,report){
  const{blocks:b,geometry:p}=model.root.userData;
  for(const key of ['outputTeeth','driverTeeth','innerScale','shiftTeeth','toothThicknessFactor'])
    if(report.parameters[key]!==p[key])throw new Error('Relief parameter mismatch: '+key);
  for(const key of ['outputInnerScale','driverInnerScale'])
    if((report.parameters[key]??report.parameters.innerScale)!==p[key])throw new Error('Relief face-width mismatch: '+key);
  for(const row of report.relief.rows){
    const tooth=b.driverC.userData.toothMeshes.find(t=>t.userData.index===row.index);
    tooth.geometry=conicalChartGeometry(row.polygons,{outerDistance:b.driverC.userData.outerDistance,
      pitchConeAngle:b.driverC.userData.pitchConeAngle,innerScale:b.driverC.userData.innerDistance/b.driverC.userData.outerDistance});
  }
}
