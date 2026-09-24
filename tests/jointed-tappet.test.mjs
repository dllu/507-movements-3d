import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeJointedTappetCounter} from '../src/simulation/jointed-tappet.js';
import {sampleJointedTappetMotion} from '../src/simulation/jointed-tappet-motion.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const dispose=model=>model.root.traverse(x=>{x.geometry?.dispose();x.material?.dispose();});
const pose=(model,time)=>{model.update(time);model.root.updateMatrixWorld(true);return model.root.userData.kinematics;};

test('076 locates C, the hinged end B, the holding pawl and D on a complete coaxial driver',()=>{
  const model=makeJointedTappetCounter(),u=model.root.userData,p=u.geometry;
  const source=point=>[(point[0]-430.6218296914268)/386.44619718290693,(591.201567806139-point[1])/386.44619718290693];
  for(const [block,pixel] of [['tappet',[1125,637]],['dog',[994,671]],['holding',[271,168]]]){
    const expected=source(pixel);near(u.blocks[block].position.x,expected[0]);near(u.blocks[block].position.y,expected[1]);
  }
  const D=source([1187,358]);near(u.parts.driverStud.position.x,D[0]);near(u.parts.driverStud.position.y,D[1]);
  assert.deepEqual(u.blocks.driver.position.toArray(),[0,0,0]);assert.deepEqual(u.blocks.wheel.position.toArray(),[0,0,0]);
  assert.equal(p.teeth,20);assert.equal(Object.keys(u.parts).length,24);assert.equal(u.fidelity,'authored');assert.equal(u.hideGround,true);
  assert.match(u.idealConstraints,/reconstruction assumptions/);near(u.profile.physics.load,3);assert.deepEqual(u.profile.physics.damping,[3,.008,100,.003]);
  for(const family of ['driver','wheel','tappet','dog','holding']){
    near(u.masses[family].volume*u.profile.physics.density,u.profile.physics.mass[family].mass,1e-10);
  }
  dispose(model);
});

test('076 every physical mesh is closed, connected, outward and nondegenerate',()=>{
  const model=makeJointedTappetCounter();
  for(const [name,mesh] of Object.entries(model.root.userData.parts)){
    const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,edges=new Map(),parents=[];
    const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
    let volume=0;
    for(let i=0;i<(g.index?.count??p.count);i+=3){
      const ids=[0,1,2].map(j=>g.index?g.index.getX(i+j):i+j),vertices=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),
        [a,b,c]=vertices,cross=b.clone().sub(a).cross(c.clone().sub(a)),triangle=parents.length;parents.push(triangle);
      assert.ok(cross.lengthSq()>1e-22,`${name}: degenerate triangle`);volume+=a.dot(b.clone().cross(c))/6;
      const normal=ids.reduce((s,j)=>s.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3());
      assert.ok(cross.dot(normal)>0,`${name}: inward shading normal`);
      const keys=vertices.map(v=>v.toArray().join(','));
      for(let j=0;j<3;j++){
        const a=keys[j],b=keys[(j+1)%3],key=a<b?a+'/'+b:b+'/'+a,e=edges.get(key)??{count:0,winding:0,triangle};
        e.count++;e.winding+=a<b?1:-1;parents[find(triangle)]=find(e.triangle);edges.set(key,e);
      }
    }
    assert.ok(volume>0,`${name}: enclosed volume`);
    assert.ok([...edges.values()].every(e=>e.count===2&&e.winding===0),`${name}: open boundary`);
    assert.equal(new Set(parents.map((_,i)=>find(i))).size,1,`${name}: detached component`);
  }
  dispose(model);
});

test('076 all four bearings have real bores with supporting material around them',()=>{
  const model=makeJointedTappetCounter(),u=model.root.userData,p=u.geometry;
  for(const [name,center,z,r] of [['driverBody',[0,0],-.25,.106],['wheelBody',[0,0],0,.106],['tappetBody',[0,0],.13,.056],['tappetBody',p.B,.13,.032],['dogBody',[0,0],.22,.032],['holdingBody',[0,0],.22,.039]]){
    const solid=solidSurface(u.parts[name].geometry);
    for(let i=0;i<8;i++){
      const angle=2*Math.PI*(i+.37)/8;
      const at=radius=>new THREE.Vector3(center[0]+radius*Math.cos(angle),center[1]+radius*Math.sin(angle),z);
      assert.equal(solid.inside(at(r*.7)),false,`${name}: missing bore`);
      assert.equal(solid.inside(at(r+.008)),true,`${name}: missing bearing wall`);
    }
  }
  dispose(model);
});

test('076 settles one counterclockwise tooth per clockwise driver turn and resets its joint',()=>{
  const model=makeJointedTappetCounter(),u=model.root.userData,p=u.geometry;
  near(pose(model,0).q,0);near(pose(model,.2).q,.3);
  assert.ok(pose(model,1).theta>p.wheelStart+1.5*p.pitch,'The unconstrained wheel must overtravel before settling');
  assert.ok(pose(model,3.26525).alpha<-.9,'The joint must fold to pass the return tooth');
  for(const cycle of [0,1,2,9,19,20,63]){
    const held=pose(model,cycle*12+4);near(held.theta,p.wheelStart+(cycle+1)*p.pitch);near(held.q,.3);near(held.alpha,0);near(held.holdingAngle,0);
    const next=pose(model,(cycle+1)*12);near(next.theta,held.theta);near(next.driverAngle,-2*Math.PI*(cycle+1));near(next.q,.3);
  }
  for(const time of [12.07,12.53,15.1,19.2]){
    const a=pose(model,time),b=pose(model,time+12);near(b.theta-a.theta,p.pitch);near(b.q,a.q);near(b.alpha,a.alpha);near(b.holdingAngle,a.holdingAngle);
    pose(model,time+57);assert.deepEqual(pose(model,time),a,'Seeking must be independent of update order');
  }
  near(u.animationTiming.authoredCyclePeriod,12);near(u.minimumDisplayCycleSeconds,12);dispose(model);
});

test('076 the cached clock is continuous at wraps, clamps negative time and rejects invalid clocks',()=>{
  assert.deepEqual(sampleJointedTappetMotion(-1),sampleJointedTappetMotion(0));
  for(const time of [NaN,Infinity,-Infinity])assert.throws(()=>sampleJointedTappetMotion(time),/clock/);
  for(const period of [0,-1,NaN,Infinity])assert.throws(()=>sampleJointedTappetMotion(1,{period}),/clock/);
  for(const cycle of [1,2,20])for(const key of ['q','alpha','theta','holdingAngle','driverAngle']){
    near(sampleJointedTappetMotion(cycle*12-1e-9)[key],sampleJointedTappetMotion(cycle*12+1e-9)[key],2e-9);
  }
  const slow=sampleJointedTappetMotion(.53),fast=sampleJointedTappetMotion(.53*2/3,{period:8});
  for(const key of ['q','alpha','theta','holdingAngle','driverAngle'])near(slow[key],fast[key]);
  slow.angularVelocities.forEach((v,k)=>near(fast.angularVelocities[k],v*1.5));
});

test('076 actual working noses and mechanical stops resist motion into their contacting surfaces',()=>{
  const model=makeJointedTappetCounter(),u=model.root.userData;
  const cases=[
    {time:.53,a:'dogNose',b:'wheelBody',block:'wheel',delta:-1e-4},
    {time:4,a:'holdingNose',b:'wheelBody',block:'wheel',delta:-1e-4},
    {time:0,a:'dogStopPin',b:'dogStopSector',block:'dog',delta:1e-3},
    {time:4,a:'tappetRestPin',b:'tappetRestSector',block:'tappet',delta:1e-3},
    {time:.45,a:'driverStud',b:'tappetBody',block:'driver',delta:-1e-4},
  ];
  for(const c of cases){
    const pairs=[[c.a,c.b],[c.b,c.a]].map(([a,b])=>({a,b,
      points:surfacePoints(u.parts[a].geometry),solid:solidSurface(u.parts[b].geometry)}));
    // The long stud spans past both faces of the thin bar. Probe its actual
    // straight side generators inside the bar's axial interval as well.
    if(c.a==='driverStud'){
      const position=u.parts.driverStud.geometry.attributes.position;
      for(let i=0;i<position.count;i++){
        const point=new THREE.Vector3().fromBufferAttribute(position,i);
        if(Math.hypot(point.x,point.y)>.06){point.z=.13;pairs[0].points.push(point);}
      }
    }
    const penetrates=()=>{
      return pairs.some(({a,b,points,solid})=>{
        const matrix=u.parts[b].matrixWorld.clone().invert().multiply(u.parts[a].matrixWorld);
        return points.some(sample=>{const p=sample.clone().applyMatrix4(matrix);return solid.inside(p)&&solid.distance(p)>1e-6;});
      });
    };
    pose(model,c.time);assert.equal(penetrates(),false,`${c.a}: nominal intrusion`);
    u.blocks[c.block].rotation.z+=c.delta;model.root.updateMatrixWorld(true);
    assert.equal(penetrates(),true,`${c.a}: missing physical contact`);
  }
  dispose(model);
});

test('076 independent solids clear each other through strike, overtravel, folding and the next turn',()=>{
  const model=makeJointedTappetCounter(),u=model.root.userData;
  const parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
  for(const time of [0,.16,.45,.52,.54,.6,1,1.4,2,2.9,3.1,3.26525,3.38,4,6,9,11.9,12.53]){
    pose(model,time);
    for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
      if(u.families[parts[i].name]===u.families[parts[j].name])continue;
      for(const [a,b] of [[parts[i],parts[j]],[parts[j],parts[i]]]){
        const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
        if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
        for(const sample of a.points){const point=sample.clone().applyMatrix4(matrix);
          if(b.solid.inside(point))assert.ok(b.solid.distance(point)<=1e-6,`${a.name} enters ${b.name} at ${time}`);
        }
      }
    }
  }
  dispose(model);
});

test('076 section view clips only driver display and leaves physical buffers and state intact',()=>{
  const model=makeJointedTappetCounter(),u=model.root.userData;
  const buffers=Object.fromEntries(Object.entries(u.parts).map(([name,mesh])=>[name,mesh.geometry.attributes.position.array.slice()]));
  assert.equal(u.configuration,'section');assert.equal(u.sections.length,3);
  for(const time of [0,.53,3.26525,6,9,12.53]){
    const state=pose(model,time);
    for(const view of ['complete','section']){
      u.setConfiguration(view);assert.deepEqual(u.kinematics,state);
      for(const [name,mesh] of Object.entries(u.parts)){
        assert.deepEqual(mesh.geometry.attributes.position.array,buffers[name]);
        assert.equal(mesh.material.clippingPlanes?.length??0,view==='section'&&u.families[name]==='driver'?3:0);
      }
      for(const section of u.sections){assert.equal(section.root.visible,view==='section');section.root.traverse(mesh=>{
        if(mesh.geometry){assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));assert.equal(mesh.material.clippingPlanes.length,0);}
      });}
    }
  }
  assert.throws(()=>u.setConfiguration('unknown'),/view/);dispose(model);
});
