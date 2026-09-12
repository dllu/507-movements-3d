import assert from 'node:assert/strict';
import {renderedPrism} from './crossed-rack-mesh-prisms.mjs';

const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)],
  dot=(a,b)=>a[0]*b[0]+a[1]*b[1],norm=p=>Math.hypot(...p),
  box=points=>({min:[0,1].map(k=>Math.min(...points.map(p=>p[k]))),max:[0,1].map(k=>Math.max(...points.map(p=>p[k])))}),
  intersects=(a,b)=>[0,1].every(k=>a.min[k]<=b.max[k]&&b.min[k]<=a.max[k]);
const gap=(a,b,n)=>{
  const A=a.map(p=>dot(p,n)),B=b.map(p=>dot(p,n));
  return[Math.min(...A)-Math.max(...B),Math.min(...B)-Math.max(...A)];
};
function tree(cells){
  const bounds=box(cells.flatMap(c=>[c.min,c.max]));if(cells.length<=8)return{...bounds,cells};
  const axis=bounds.max[0]-bounds.min[0]>bounds.max[1]-bounds.min[1]?0:1,ordered=[...cells].sort((a,b)=>a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]),middle=ordered.length>>1;
  return{...bounds,children:[tree(ordered.slice(0,middle)),tree(ordered.slice(middle))]};
}
function query(node,bounds,result){
  if(!intersects(node,bounds))return;
  if(node.cells){for(const c of node.cells)if(intersects(c,bounds))result.push(c);}
  else for(const child of node.children)query(child,bounds,result);
}

export function makePumpCatchPrimaryBounds(model,{onlyPairs}={}){
  const u=model.root.userData,pivot=u.geometry.pivot,definitions=[
    {name:'cam',moving:'hookedCatchB',other:'pointedCamC',frame:'cam',pivot},
    {name:'shaft',moving:'hookedCatchB',other:'inputShaft',frame:'cam',pivot},
    {name:'stop',moving:'hookedCatchB',other:'fixedTripStop',frame:'fixed',pivot},
    ...(u.heelStop?[{name:'heel',moving:'catchHeelLug',other:'wheelHeelStop',frame:'wheel',pivot:[0,0]}]:[]),
    ...(u.parts.catchHeadBack?[
      {name:'head-shaft',moving:'catchHeadBack',other:'inputShaft',frame:'cam',pivot},
      {name:'head-stop',moving:'catchHeadBack',other:'fixedTripStop',frame:'fixed',pivot},
    ]:[]),
    ...(u.parts.catchHeelLug?[{name:'lug-shaft',moving:'catchHeelLug',other:'inputShaft',frame:'cam',pivot}]:[]),
  ].filter(d=>!onlyPairs||onlyPairs.includes(d.name));
  const pairs=definitions.map(d=>{
    const moving=renderedPrism(u.parts[d.moving].geometry),other=renderedPrism(u.parts[d.other].geometry);
    assert(moving.low<other.high&&other.low<moving.high,'Primary prism layers overlap');
    for(const name of [d.moving,d.other]){
      const mesh=u.parts[name];assert(mesh.rotation.toArray().slice(0,3).every(v=>v===0)&&mesh.scale.toArray().every(v=>v===1));
      assert.deepEqual(mesh.position.toArray(),name==='wheelHeelStop'?[...pivot,0]:[0,0,0]);
    }
    const cells=moving.triangles.map((t,id)=>({...t,id,radius:Math.max(...t.points.map(norm))})),obstacles=other.triangles.map((t,id)=>({...t,id}));
    return{...d,cells,obstacles,tree:tree(obstacles),validation:{moving:moving.validation,other:other.validation}};
  });
  function interval(a,b,angularSpeed,{tolerance=1e-6,maximumDepth=16}={}){
    const dt=b.time-a.time,dq=a.q.map((v,k)=>(b.q[k]-v)/dt),roundoff=1e-10,effectiveTolerance=tolerance-roundoff;
    assert(dt>0&&dq.every(Number.isFinite)&&effectiveTolerance>0);
    const stats={certifiedPairs:0,boxExcludedPairs:0,subdivisions:0,maximumDepth:0,minimumLowerBound:Infinity},failures=[];
    for(const pair of pairs){
      const frameSpeed=pair.frame==='cam'?angularSpeed:pair.frame==='wheel'?dq[0]:0,
        pivotSpeed=dq[0]-frameSpeed,bodySpeed=dq[1]-frameSpeed,cache=new Map();
      const transform=f=>{
        if(!cache.has(f)){
          const time=a.time+f*dt,q=a.q.map((v,k)=>v+f*(b.q[k]-v)),frame=pair.frame==='cam'?angularSpeed*time:pair.frame==='wheel'?q[0]:0;
          cache.set(f,{pivot:rotate(pair.pivot,q[0]-frame),angle:q[1]-frame});
        }return cache.get(f);
      };
      const pose=(cell,f)=>{
        const t=transform(f);return{points:cell.points.map(p=>rotate(p,t.angle).map((v,k)=>v+t.pivot[k])),normals:cell.normals.map(n=>rotate(n,t.angle))};
      };
      for(const local of pair.cells){
        // With linear angle playback in the obstacle frame, every vertex is
        // R(theta-frame)*pivot + R(phi-frame)*local. Its acceleration norm is
        // bounded by |pivot|*(theta'-frame')² + |local|*(phi'-frame')².
        // A scalar projection differs from its endpoint chord by at most
        // acceleration*duration²/8. This also bounds the swept broad-phase box.
        const acceleration=norm(pair.pivot)*pivotSpeed**2+local.radius*bodySpeed**2,A=pose(local,0),B=pose(local,1),
          padding=acceleration*dt*dt/8+roundoff,bounds=box([...A.points,...B.points]);
        bounds.min=bounds.min.map(v=>v-padding);bounds.max=bounds.max.map(v=>v+padding);const considered=[];query(pair.tree,bounds,considered);
        stats.boxExcludedPairs+=pair.obstacles.length-considered.length;
        function certify(other,lo,hi,depth,start,end){
          const mid=(lo+hi)/2,middle=pose(local,mid),curvature=acceleration*((hi-lo)*dt)**2/8;let bestLower=-Infinity,bestMid=-Infinity;
          stats.maximumDepth=Math.max(stats.maximumDepth,depth);
          for(const axis of [...other.normals,...middle.normals]){
            const g0=gap(start.points,other.points,axis),g1=gap(end.points,other.points,axis),lower=Math.max(...g0.map((v,k)=>Math.min(v,g1[k])-curvature));
            bestLower=Math.max(bestLower,lower);
            if(lower>=-effectiveTolerance){stats.certifiedPairs++;stats.minimumLowerBound=Math.min(stats.minimumLowerBound,lower-roundoff);return;}
            bestMid=Math.max(bestMid,...gap(middle.points,other.points,axis));
          }
          if(bestMid< -effectiveTolerance||depth>=maximumDepth){failures.push({pair:pair.name,movingCell:local.id,otherCell:other.id,
            lo:a.time+lo*dt,hi:a.time+hi*dt,time:a.time+mid*dt,depth,lower:bestLower,midpointGap:bestMid,
            reason:bestMid< -effectiveTolerance?'interpolated-triangle-overlap':'unresolved-curvature-bound'});return;}
          stats.subdivisions++;certify(other,lo,mid,depth+1,start,middle);if(!failures.length)certify(other,mid,hi,depth+1,middle,end);
        }
        for(const other of considered){certify(other,0,1,0,A,B);if(failures.length)return{passed:false,stats,failures};}
      }
    }
    return{passed:true,stats,failures};
  }
  return{interval,parameters:pairs.map(p=>({name:p.name,movingCells:p.cells.length,otherCells:p.obstacles.length,frame:p.frame,pivot:p.pivot,validation:p.validation})),
    qualification:'Every rendered primary cap triangle belongs to a verified complete prism. In the fixed, input or wheel frame, constant interpolated angular speeds bound every vertex acceleration. Endpoint projection gaps minus acceleration*dt²/8 certify separation on a fixed axis throughout each interval; swept boxes use the same curvature bound. The 1e-6 tolerance applies to triangle separation. This proves the supplied linear playback intervals, not unsampled solver solutions, future extrapolation or secondary hardware.'};
}
