import { writeFile } from 'node:fs/promises';
import { makeOpenRimTappetCandidate } from './lib/open-rim-tappet-candidate.mjs';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
const model=makeOpenRimTappetCandidate(),{parts,blocks,geometry:p}=model.root.userData;
const rim={mesh:parts.rim,solid:solidSurface(parts.rim.geometry),points:surfacePoints(parts.rim.geometry)};
const pinSolid=solidSurface(parts.stud0.geometry),pinPoints=surfacePoints(parts.stud0.geometry);
const studs=Array.from({length:10},(_,i)=>({mesh:parts[`stud${i}`],solid:pinSolid,points:pinPoints}));
const rows=[],overtravel=.001;
for(let stud=0;stud<10;stud++)for(const sign of [-1,1]){
  model.update(-p.initialInputPhase);
  const seat=sign*p.lockSeat-stud*p.pitch;
  const inspect=(angle,stopAtFirst)=>{
    blocks.output.rotation.z=angle;model.root.updateMatrixWorld(true);
    let checks=0,inside=0,maximumDepth=0,witness=null;
    for(const pin of studs)for(const[a,b]of[[rim,pin],[pin,rim]]){
      const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for(const sample of a.points){checks++;const point=sample.clone().applyMatrix4(matrix);
        if(!b.solid.inside(point))continue;
        const depth=b.solid.distance(point);if(depth<=1e-6)continue;
        inside++;maximumDepth=Math.max(maximumDepth,depth);witness??={source:a.mesh.name,target:b.mesh.name,point:point.toArray(),depth};
        if(stopAtFirst)return{checks,inside,maximumDepth,witness};
      }
    }
    return{checks,inside,maximumDepth,witness};
  };
  rows.push({stud,sign,seat,allowed:inspect(seat,false),blocked:inspect(seat+sign*overtravel,true)});
}
const issues=rows.filter(r=>r.allowed.inside||!r.blocked.inside);
const report={movement:70,status:'isolated-actual-solid-locking-audit',productionChanged:false,
  method:'All ten actual Float32 studs against the actual open rim, vertices, edge midpoints and face centers in both directions. Both load-direction seats at each of ten output positions must be clear to 1e-6. A further 0.001 radian of rotation into each stop must have a penetrating witness. Independent force checks validate the reaction direction.',
  fullAngularPlay:2*p.lockSeat,overtravel,poses:rows.length,checks:rows.reduce((s,r)=>s+r.allowed.checks+r.blocked.checks,0),rows,issues};
await writeFile('artifacts/review/070-refined-locking.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,checks:report.checks,issues:issues.length});if(issues.length)process.exitCode=1;
