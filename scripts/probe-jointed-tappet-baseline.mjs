import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';

const catalog=JSON.parse(await readFile('src/data/movements.json','utf8')),model=createMovementModel(catalog.movements[75]),
  u=model.root.userData,b=u.blocks,p=u.geometry,groups={},excluded=[];
model.root.updateMatrixWorld(true);
for(const name of ['ratchetBody','ratchetShaft','pawlBody','pawlCatch','pawlPivotHub','pawlStop',
  'driverStud','tappetMainArm','tappetContactLip','tappetHub','fixedPivotShaft']){
  groups[name]=[];
  b[name].traverse(mesh=>{
    if(!mesh.geometry)return;
    const scale=mesh.getWorldScale(new THREE.Vector3()),g=mesh.geometry.clone().scale(...scale.toArray()),v=g.attributes.position,index=g.index,indices=[];
    let removed=0;
    for(let i=0;i<(index?.count??v.count);i+=3){
      const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),[a,b,c]=ids.map(j=>new THREE.Vector3().fromBufferAttribute(v,j));
      if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-22)removed++;else indices.push(...ids);
    }
    g.setIndex(indices);const label=name+':'+groups[name].length;
    groups[name].push({mesh,label,scale,solid:solidSurface(g),points:surfacePoints(g)});excluded.push({label,removed});
  });
}
const pairs=[['ratchetBody','pawlCatch'],['ratchetBody','pawlBody'],['ratchetBody','ratchetShaft'],
  ['driverStud','tappetContactLip'],['driverStud','tappetMainArm'],['driverStud','tappetHub'],
  ['tappetHub','fixedPivotShaft'],['tappetMainArm','fixedPivotShaft'],['pawlBody','pawlStop'],['pawlPivotHub','tappetMainArm']]
  .map(([a,b])=>({a,b,sameRigidFamily:a==='ratchetBody'&&b==='ratchetShaft',checks:0,inside:0,maximumDepth:0}));
const phases=[0,.25,.5,.75,1,...Array.from({length:33},(_,i)=>(i+.371)/33),
  ...[.019,.073,.151,.29,.413,.627,.79,.94,.991].flatMap(t=>[
    p.contactStartPhase+t*p.contactPhaseSpan,p.contactEndPhase+t*p.returnPhaseSpan])],readings=[];
for(const phase of phases){
  const time=(phase-p.initialCyclePhase)*p.fullTurn/p.driverAngularSpeed;model.update(time);model.root.updateMatrixWorld(true);
  for(const group of Object.values(groups))for(const part of group){
    if(part.mesh.getWorldScale(new THREE.Vector3()).distanceTo(part.scale)>1e-10)throw new Error('Changing scale');
    part.matrix=part.mesh.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(1/part.scale.x,1/part.scale.y,1/part.scale.z));
  }
  for(const pair of pairs)for(const x of groups[pair.a])for(const y of groups[pair.b])for(const [a,b] of [[x,y],[y,x]]){
    const matrix=b.matrix.clone().invert().multiply(a.matrix);if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
    for(const sample of a.points){
      pair.checks++;const point=sample.clone().applyMatrix4(matrix);if(!b.solid.inside(point))continue;
      const depth=b.solid.distance(point);if(!Number.isFinite(depth))throw new Error('Nonfinite distance');
      if(depth<=1e-6)continue;pair.inside++;
      if(depth>pair.maximumDepth){pair.maximumDepth=depth;pair.witness={phase,from:a.label,to:b.label,point:point.toArray(),depth};}
    }
  }
  const s=u.kinematics;readings.push({phase,stage:s.stage,driverAngle:s.driverAngle,tappetAngle:s.tappetAngle,
    drivenAngle:s.drivenAngle,pawlRelativeAngle:s.pawlRelativeAngle,claimedPawlClearance:s.pawlProfileClearance,
    claimedStudContactError:s.studTappetContactError,claimedStudContact:s.studTappetContactEngaged});
}
const report={movement:76,status:'selected-baseline-surface-diagnosis',productionChanged:false,poses:phases.length,pairs,
  checks:pairs.reduce((s,r)=>s+r.checks,0),inside:pairs.reduce((s,r)=>s+r.inside,0),
  independentChecks:pairs.filter(r=>!r.sameRigidFamily).reduce((s,r)=>s+r.checks,0),
  independentInside:pairs.filter(r=>!r.sameRigidFamily).reduce((s,r)=>s+r.inside,0),excluded,readings,
  source:{file:'artifacts/review/076-original-factory.txt',sha256:createHash('sha256').update(await readFile('artifacts/review/076-original-factory.txt')).digest('hex')},
  qualification:'Ten selected hardware pairs in both directions, actual Float32 vertices, edge midpoints and triangle centers. World scale is baked into query geometry; zero-area triangles are omitted. Co-rotating wheel/shaft overlap is classified separately as a possible integral join. Driver-rim representation, support-frame completeness and dynamic equilibrium are not certified.'};
await writeFile('artifacts/review/076-baseline-surfaces.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:report.poses,checks:report.checks,inside:report.inside,independentInside:report.independentInside,failures:pairs.filter(r=>r.inside)});
