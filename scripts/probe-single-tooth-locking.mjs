import { writeFile } from 'node:fs/promises';
import { makeSingleToothIndexCandidate } from './lib/single-tooth-index-candidate.mjs';
import profile from './lib/single-tooth-event-source-profile.mjs';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const model=makeSingleToothIndexCandidate({profile}),p=profile.parameters;
const {driverPlate,notchedPlate}=model.root.userData.parts;
const data=[driverPlate,notchedPlate].map(mesh=>({mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
const rows=[],overtravel=.001;
for(let notch=0;notch<p.notches;notch++)for(const sign of [-1,1]){
  const time=(p.sourceAngle-.9+2*Math.PI*notch)/p.driverSpeed;
  model.update(time);
  const seat=-p.halfPitch+sign*p.lockSeat+notch*p.pitch;
  const inspect=(angle,stopAtFirst)=>{
    model.root.userData.blocks.output.rotation.z=angle;model.root.updateMatrixWorld(true);
    let checks=0,inside=0,maximumDepth=0,witness=null;
    for(const [a,b] of [[data[0],data[1]],[data[1],data[0]]]){
      const transform=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for(const q of a.points){
        checks++;const point=q.clone().applyMatrix4(transform);if(!b.solid.inside(point))continue;
        const depth=b.solid.distance(point);if(depth<=1e-6)continue;
        inside++;maximumDepth=Math.max(maximumDepth,depth);
        witness??={source:a.mesh.name,target:b.mesh.name,point:point.toArray(),depth};
        if(stopAtFirst)return {checks,inside,maximumDepth,witness};
      }
    }
    return {checks,inside,maximumDepth,witness};
  };
  rows.push({notch,sign,seat,allowed:inspect(seat,false),blocked:inspect(seat+sign*overtravel,true)});
}
const issues=rows.filter(r=>r.allowed.inside||!r.blocked.inside);
const report={movement:68,status:'isolated-locking-solid-audit',method:'Both directions of all actual Float32 plate surface samples at both analytically seated load directions for all ten notches. Each valid seat must be clear to 1e-6; an extra 0.001 radian into that locking flank must have an actual penetrating witness. Independent force-cone checks establish reaction direction.',
  seatOffset:p.lockSeat,fullAngularPlay:2*p.lockSeat,overtravel,rows,issues};
await writeFile('artifacts/review/068-event-locking.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,checks:rows.reduce((s,r)=>s+r.allowed.checks+r.blocked.checks,0),issues:issues.length});
if(issues.length)process.exitCode=1;
