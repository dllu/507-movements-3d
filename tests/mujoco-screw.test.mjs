import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoScrew} from '../src/simulation/mujoco-screw/visual.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';
const mujoco=await loadMujoco();
const feedError=v=>v.physics.data.qpos[1]-v.root.userData.profile.lead*v.physics.data.qpos[0];

test('102 native convex sectors preserve the complete visible helical working faces',t=>{
  const v=makeMujocoScrew(mujoco),p=v.physics,u=v.root.userData;
  let vertexError=0,flankError=0,protrusion=0,vertices=0,faces=0;
  try {
    assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.jnt_stiffness[1],0);
    assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','turn'));
    assert.equal(Object.keys(u.parts).length,6);
    for(const part of Object.values(u.parts)) {
      const a=inspectWeightedClutchSolid(part.geometry);
      assert.equal(a.components,1);assert.ok(a.volume>0);for(const key of ['degenerate','wrongNormals','nonfinite','unmatchedEdges'])assert.equal(a[key],0,part.name+' '+key);
    }
    for(const [family,cells] of Object.entries(p.description.cells)) {
      const surface=solidSurface(u.parts[family==='screw'?'externalThread':'internalThread'].geometry);
      for(let i=0;i<cells.length;i++) {
        const id=p.id('mjOBJ_GEOM',family+i),mesh=p.model.geom_dataid[id],start=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh];
        const matrix=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());
        matrix.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));
        const points=Array.from({length:count},(_,j)=>{
          const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(start+j)*3).applyMatrix4(matrix);
          if(family==='nut')point.z-=u.profile.nutBase;
          vertexError=Math.max(vertexError,surface.distance(point));vertices++;return point;
        });
        const first=p.model.mesh_faceadr[mesh],n=p.model.mesh_facenum[mesh];
        for(let j=0;j<n;j++) {
          const indices=Array.from(p.model.mesh_face.slice((first+j)*3,(first+j+1)*3));assert.ok(indices.every(k=>k>=0&&k<count));
          const triangle=new THREE.Triangle(...indices.map(k=>points[k])),normal=triangle.getNormal(new THREE.Vector3());
          for(const weights of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]) {
            const point=new THREE.Vector3();indices.forEach((k,l)=>point.addScaledVector(points[k],weights[l]));
            const distance=surface.signedDistance(point);protrusion=Math.max(protrusion,distance);
            // Angular partition faces lie inside the thread; the axial flanks
            // are its actual load-bearing outer boundary.
            if(Math.abs(normal.z)>.9)flankError=Math.max(flankError,Math.abs(distance));faces++;
          }
        }
      }
    }
    t.diagnostic(JSON.stringify({geoms:p.model.ngeom,vertices,faceSamples:faces,vertexErrorPixels:100*vertexError,workingFlankErrorPixels:100*flankError,protrusionPixels:100*protrusion}));
    assert.ok(vertexError*100<.06);assert.ok(flankError*100<.06);assert.ok(protrusion*100<.06);
  }finally{v.dispose();}
});

test('102 feed is passive, loads select opposite flanks, and restart is independent of render frames',t=>{
  const v=makeMujocoScrew(mujoco),p=v.physics;
  try {
    v.update(2);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.reset();p.model.opt.gravity.fill(0);p.model.geom_contype.fill(0);p.model.geom_conaffinity.fill(0);
    v.update(3);assert.ok(Math.abs(p.data.qpos[1])<1e-10);assert.ok(p.data.qpos[0]<-15);
  }finally{v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
  const offsets=[];
  for(const load of [-2,2]) {
    const v=makeMujocoScrew(mujoco,{load,period:1e6}),p=v.physics;
    try {
      p.model.opt.gravity.fill(0);v.update(1);const offset=feedError(v);offsets.push(100*offset);
      assert.ok(Math.sign(offset)===Math.sign(load));assert.ok(Math.abs(offset)*100>.15&&Math.abs(offset)*100<.35);assert.ok(p.data.ncon>0);
    }finally{v.dispose();}
  }
  t.diagnostic(JSON.stringify({loadedFlankOffsetsPixels:offsets}));
});

test('102 ten complete cycles retain full nut engagement and keep finite hardware separate',t=>{
  const v=makeMujocoScrew(mujoco),p=v.physics,u=v.root.userData,f=u.profile,trajectory=[];
  const surfaces={screw:solidSurface(u.parts.externalThread.geometry),nut:solidSurface(u.parts.internalThread.geometry)};
  let error=0,penetration=0,visiblePenetration=0,contactError=0,retention=Infinity,headClearance=Infinity,checks=0,poses=0,contacts=0,tracking=0;
  let minimum=Infinity,maximum=-Infinity;
  try {
    for(let i=0;i<=60000;i++) {
      if(i)p.step();const [angle,feed]=p.data.qpos;assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      error=Math.max(error,Math.abs(feedError(v)));trajectory.push(feed);minimum=Math.min(minimum,feed);maximum=Math.max(maximum,feed);
      tracking=Math.max(tracking,Math.abs(angle-p.description.input(p.data.time).angle));
      retention=Math.min(retention,f.nutBase+feed-f.nutHeight/2-f.external.low);
      headClearance=Math.min(headClearance,-f.nutBase-feed-f.nutHeight/2);
      if(i%100===0)v.sync();
      const cs=p.data.contact;
      for(let j=0;j<cs.size();j++) {
        const c=cs.get(j);contacts++;penetration=Math.max(penetration,-c.dist);
        if(i%100===0) {
          const point=new THREE.Vector3().fromArray(c.pos);contactError=Math.max(contactError,surfaces.screw.distance(point));
          point.z-=f.nutBase+feed;point.applyAxisAngle(new THREE.Vector3(0,0,1),-angle);
          contactError=Math.max(contactError,surfaces.nut.distance(point));
        }
        c.delete();
      }
      cs.delete();
      if(i<=6000&&i%200===0) {
        const a=auditClutchSourceSolids(v);checks+=a.checks;poses++;assert.deepEqual(a.topologyIssues,[]);
        for(const issue of a.issues){assert.ok([issue.from,issue.to].includes('externalThread')&&[issue.from,issue.to].includes('internalThread'),JSON.stringify(issue));visiblePenetration=Math.max(visiblePenetration,-issue.gap);}
        for(const mesh of Object.values(u.parts)){const pos=mesh.geometry.attributes.position;for(let j=0;j<pos.count;j++)assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld)),mesh.name);}
      }
    }
    let reverse=0;
    for(let k=0;k<20;k++) {
      // Omit the first/last 0.1 s of each half-cycle, where clearance settles
      // as the input reverses. Check for additional reversals inside strokes.
      const sign=k%2?-1:1,start=k*3000+50,end=(k+1)*3000-50;let best=sign*trajectory[start];
      for(let i=start;i<=end;i++){const x=sign*trajectory[i];reverse=Math.max(reverse,best-x);best=Math.max(best,x);}
    }
    t.diagnostic(JSON.stringify({feedErrorPixels:100*error,nativePenetrationPixels:100*penetration,visiblePenetrationPixels:100*visiblePenetration,
      contactSurfaceErrorPixels:100*contactError,strokePixels:100*(maximum-minimum),lowerRetentionPixels:100*retention,headClearancePixels:100*headClearance,
      trackingDegrees:tracking*180/Math.PI,reversePixels:100*reverse,contacts,poses,checks}));
    assert.ok(error*100<.35);assert.ok(penetration*100<.05);assert.ok(visiblePenetration*100<.02);assert.ok(contactError*100<.12);
    assert.ok(retention>.025);assert.ok(headClearance>.68);assert.ok(maximum-minimum>1.49);assert.ok(reverse*100<.1);assert.ok(contacts>100000);
  }finally{v.dispose();}
});

test('102 timestep and helical-sector refinement bound two full travel cycles',t=>{
  const options=[{}, {timestep:.001}, {timestep:.0005}, {timestep:.001,contactSegments:128}],vs=options.map(o=>makeMujocoScrew(mujoco,o)),differences=[0,0,0];
  try {
    for(let i=1;i<=12000;i++) {
      for(const v of vs)for(let k=0;k<.002/v.physics.timestep;k++)v.physics.step();
      for(const [j,a,b] of [[0,0,1],[1,1,2],[2,1,3]])differences[j]=Math.max(differences[j],Math.abs(vs[a].physics.data.qpos[1]-vs[b].physics.data.qpos[1]));
    }
    t.diagnostic(JSON.stringify({timestepPixels:100*differences[0],refinedTimestepPixels:100*differences[1],sectorRefinementPixels:100*differences[2]}));
    assert.ok(differences[0]*100<.15);assert.ok(differences[1]<differences[0]);assert.ok(differences[2]*100<.1);
  }finally{vs.forEach(v=>v.dispose());}
});

test('102 rotating section caps follow the finite nut without changing its physical model',t=>{
  const v=makeMujocoScrew(mujoco),u=v.root.userData,p=v.physics,surfaces=['nutBody','internalThread'].map(n=>solidSurface(u.parts[n].geometry));let excess=0,samples=0;
  try {
    const q=Array.from(p.data.qpos),volume=p.description.mass.volume;
    for(let i=0;i<36;i++) {
      u.setSectionView(true);const angle=i*2*Math.PI/36,height=u.profile.nutBase+.5;u.section.update(angle,height);
      const cap=u.section.cap,g=cap.geometry,positions=g.attributes.position;assert.ok(cap.userData.presentationOnly);
      for(let j=0;j<g.drawRange.count;j+=3) {
        const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(positions,j+k));points.push(points.reduce((s,p)=>s.add(p),new THREE.Vector3()).divideScalar(3));
        for(const point of points){point.z-=height;point.applyAxisAngle(new THREE.Vector3(0,0,1),-angle);excess=Math.max(excess,Math.min(...surfaces.map(s=>s.signedDistance(point))));samples++;}
      }
    }
    u.setSectionView(false);assert.deepEqual(Array.from(p.data.qpos),q);assert.equal(p.description.mass.volume,volume);assert.equal(u.section.cap.visible,false);
    t.diagnostic(JSON.stringify({capSurfaceExcessPixels:100*excess,samples}));assert.ok(excess*100<.01);
  }finally{v.dispose();}
});

test('p109: 102 square thread has land equal to groove on Brown\'s measured radii', async () => {
  const {makeScrewProfile} = await import('../src/simulation/mujoco-screw/profile.js');
  const f = makeScrewProfile();
  assert.ok(Math.abs(f.external.width - f.pitch / 2) < 1e-12);
  assert.ok(Math.abs(f.internal.width - (f.pitch / 2 - 2 * f.clearance)) < 1e-12);
});
