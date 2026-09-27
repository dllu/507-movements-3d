import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeReciprocatingPawlRatchet} from '../src/simulation/reciprocating-pawl.js';
import {makeReciprocatingPawlDynamics} from '../scripts/lib/reciprocating-pawl-dynamics.mjs';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const dispose=model=>model.root.traverse(x=>{x.geometry?.dispose();x.material?.dispose();});
const pose=(model,coordinate)=>{
  const p=model.root.userData.geometry;model.update((coordinate-p.sourcePhase)*p.period);model.root.updateMatrixWorld(true);
  return model.root.userData.kinematics;
};

test('075 locates both source pawls, the central axle and the pinned input rod',()=>{
  const model=makeReciprocatingPawlRatchet(),u=model.root.userData,b=u.blocks;
  model.root.updateMatrixWorld(true);
  const source=p=>[(p[0]-627.2241913809899)/391.0844456767924,(641.9135290492636-p[1])/391.0844456767924];
  for(const [name,pixel] of [['movingPawl',[257,406]],['holdingPawl',[966,294]],['rod',[790,732]]]){
    const expected=source(pixel);near(b[name].position.x,expected[0]);near(b[name].position.y,expected[1]);
  }
  assert.deepEqual(u.parts.wheelAxle.position.toArray(),[0,0,0]);
  assert.equal(u.fidelity,'authored');assert.equal(u.geometry.teeth,34);
  assert.match(u.idealConstraints,/reconstructs the unevenly drawn engraving/);
  assert.match(u.idealConstraints,/gravity, inertia/);
  assert.equal(u.hideGround,true);dispose(model);
});

test('075 every rendered solid is connected, closed, outward and nondegenerate',()=>{
  const model=makeReciprocatingPawlRatchet();
  for(const [name,mesh] of Object.entries(model.root.userData.parts)){
    const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,edges=new Map(),parents=[];
    const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
    let volume=0;
    for(let i=0;i<(g.index?.count??p.count);i+=3){
      const ids=[0,1,2].map(j=>g.index?g.index.getX(i+j):i+j),vertices=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),
        [a,b,c]=vertices,cross=b.clone().sub(a).cross(c.clone().sub(a)),triangle=parents.length;parents.push(triangle);
      assert.ok(cross.lengthSq()>1e-22,`${name}: degenerate triangle`);volume+=a.dot(b.clone().cross(c))/6;
      const normal=ids.reduce((s,j)=>s.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3());
      assert.ok(cross.dot(normal)>0,`${name}: shading normal faces inward`);
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

test('075 rod C swings on a round pin concentric with the bar bore throughout the stroke',()=>{
  const model=makeReciprocatingPawlRatchet(),u=model.root.userData,p=u.geometry,
    bar=solidSurface(u.parts.barBody.geometry),wheel=solidSurface(u.parts.wheelBody.geometry);
  assert.equal(p.slotLow,undefined);assert.equal(p.slotHigh,undefined);
  for(const [x,y] of [[.04,.03],[-.04,.03],[.04,-.03],[-.04,-.03]]){
    assert.equal(wheel.inside(new THREE.Vector3(x,y,0)),false);
    assert.equal(bar.inside(new THREE.Vector3(x,y,.1)),false);
  }
  let minimum=Infinity,maximum=-Infinity;
  for(let i=0;i<=120;i++){
    const s=pose(model,i/120),pin=u.parts.rodPin.getWorldPosition(new THREE.Vector3()),
      bore=new THREE.Vector3(...p.rodJoint,0).applyMatrix4(u.blocks.bar.matrixWorld),
      local=pin.clone().applyMatrix4(u.blocks.bar.matrixWorld.clone().invert());local.z=.1;
    near(pin.distanceTo(bore),0,1e-12);assert.equal(bar.inside(local),false);
    for(let j=0;j<16;j++){
      const angle=j*2*Math.PI/16,r=p.pinRadius+.006;
      assert.equal(bar.inside(local.clone().add(new THREE.Vector3(r*Math.cos(angle),r*Math.sin(angle),0))),true,
        'Circular bearing wall must surround the pin, including along the old slot axis');
    }
    near(pin.distanceTo(u.parts.rodJointBushing.getWorldPosition(new THREE.Vector3())),0);
    const foot=new THREE.Vector3(0,-p.rodLength,0).applyMatrix4(u.blocks.rod.matrixWorld);
    near(foot.x,p.rodX);near(foot.distanceTo(pin),p.rodLength);
    minimum=Math.min(minimum,s.rodAngle);maximum=Math.max(maximum,s.rodAngle);
  }
  assert.ok(maximum-minimum>.03,'Rod C must swing sideways');dispose(model);
});

test('075 has overhanging shark-fin crests and solid pawls in the working plane',()=>{
  const model=makeReciprocatingPawlRatchet(),u=model.root.userData,points=u.profile.points;
  const root=points[0],tip=points.at(-1),tangent=new THREE.Vector2(root[0]-tip[0],root[1]-tip[1]),
    outward=new THREE.Vector2(tangent.y,-tangent.x);
  assert.ok(outward.dot(new THREE.Vector2(...root))<0,'The short working face must undercut the crest');
  for(const name of ['movingPawlBody','holdingPawlBody']){
    u.parts[name].geometry.computeBoundingBox();const b=u.parts[name].geometry.boundingBox;
    assert.ok(b.min.z<0&&b.max.z>0,'The pawl body must reach the wheel plane');
  }
  assert.equal(u.parts.movingPawlNose,undefined);assert.equal(u.parts.holdingPawlNose,undefined);
  dispose(model);
});

test('075 seeking repeats one clockwise tooth step with continuous overshoot, drop and settling',()=>{
  const model=makeReciprocatingPawlRatchet(),u=model.root.userData,p=u.geometry;
  for(const coordinate of [-2.37,0,.183,.5,.743,1.999,16.311,33.87]){
    const first=pose(model,coordinate),position=u.blocks.rod.position.clone(),next=pose(model,coordinate+1);
    near(next.wheelAngle-first.wheelAngle,-p.pitch,1e-8);near(next.barAngle,first.barAngle,1e-9);near(next.rodY,first.rodY,1e-9);
    pose(model,coordinate+8.31);pose(model,coordinate);near(u.blocks.rod.position.distanceTo(position),0);
  }
  const physics=makeReciprocatingPawlDynamics(model,u.profile.physics),samples=[];
  let minGap=Infinity,maxPawlSpeed=0,freeDrop=0;
  for(let i=0;i<=4000;i++){
    const t=p.period*Math.min(4000,i+.271)/4000,s=u.stateAtTime(t),x=[s.wheelAngle,s.angleB,s.angleH],
      contact=physics.constraints(x,t*u.profile.playback.period/p.period);
    minGap=Math.min(minGap,...Object.values(contact.gaps));
    maxPawlSpeed=Math.max(maxPawlSpeed,...s.angularVelocities.slice(2).map(Math.abs));
    if(contact.gaps.H>.0005&&s.angularVelocities[3]<-.1)freeDrop++;
    samples.push(s);
  }
  assert.ok(minGap>=-1e-6,'Both noses must remain outside the wheel between recorded contact states');
  assert.ok(maxPawlSpeed<4,'A pawl must not jump between disconnected contact pockets');
  assert.ok(freeDrop>20,'The right pawl must fall through free space after the crest clears');
  const held=samples[Math.round(4000*.85)].wheelAngle,minimum=Math.min(...samples.map(s=>s.wheelAngle));
  assert.ok(held-minimum>.02&&held-minimum<.11,'Wheel must overtravel a little before settling back against the holding pawl');
  for(const fraction of [.8,.85,.9])near(samples[Math.round(4000*fraction)].wheelAngle,held,1e-8);
  near(p.period,4);dispose(model);
});

test('075 finite contact Jacobians agree with the geometry and free pawls close under gravity',()=>{
  const model=makeReciprocatingPawlRatchet(),u=model.root.userData,
    physics=makeReciprocatingPawlDynamics(model,u.profile.physics),h=1e-7;
  for(const t of [.1,.4,1,1.2,1.5,2.4,3.2]){
    const s=u.stateAtTime(t),x=[s.wheelAngle,s.angleB,s.angleH],contact=physics.constraints(x,t);
    assert.ok(physics.forces(x,t).slice(1).every(v=>v<0),'Gravity must close each pawl');
    for(const row of contact.rows.filter(r=>Math.abs(r.gap)<1e-7))for(let k=0;k<3;k++){
      const a=[...x],b=[...x];a[k]+=h;b[k]-=h;
      const find=q=>physics.constraints(q,t).rows.find(r=>r.id===row.id)?.gap,
        plus=find(a),minus=find(b);
      if(plus!==undefined&&minus!==undefined)near((plus-minus)/(2*h),row.J[k],1e-6);
    }
  }
  dispose(model);
});

test('075 independent finite parts clear each other through drive, pickup and return',()=>{
  const model=makeReciprocatingPawlRatchet(),u=model.root.userData,
    parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
  for(const phase of [0,.07,.19,.31,.44,.5,.53,.57,.61,.68,.75,.83,.91,.99,1]){
    pose(model,phase);
    for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
      if(u.families[parts[i].name]===u.families[parts[j].name])continue;
      for(const [a,b] of [[parts[i],parts[j]],[parts[j],parts[i]]]){
        const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
        if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
        for(const sample of a.points){
          const point=sample.clone().applyMatrix4(matrix);
          if(b.solid.inside(point))assert.ok(b.solid.distance(point)<=1e-6,`${a.name} enters ${b.name} at ${phase}`);
        }
      }
    }
  }
  dispose(model);
});

// Pass 86: each pawl is one smooth plate (boss, two smooth edges, straight
// flanks and a round nose), and its wedge tip fills the valley it seats in.
test('075 pawls are smooth, thick wedge-tipped plates seated in the tooth root',()=>{
  const model=makeReciprocatingPawlRatchet(),u=model.root.userData,p=u.geometry;
  const walls=(local,points)=>{
    const list=points.map((a,i)=>{const b=points[(i+1)%points.length],d=[b[0]-a[0],b[1]-a[1]],
      t=Math.max(0,Math.min(1,((local[0]-a[0])*d[0]+(local[1]-a[1])*d[1])/(d[0]**2+d[1]**2))),
      q=[local[0]-a[0]-t*d[0],local[1]-a[1]-t*d[1]],l=Math.hypot(...q);return{distance:l,normal:q.map(v=>v/l)};}).sort((a,b)=>a.distance-b.distance);
    return[list[0],list.find(e=>e.normal[0]*list[0].normal[0]+e.normal[1]*list[0].normal[1]<.5)];
  };
  for(const [name,kind,time] of [['movingPawlBody','B',0],['holdingPawlBody','H',.8*p.period]]){
    const descriptor=u.profile.parts.find(part=>part.name===name),[rings]=descriptor.shape.polygons;
    assert.equal(descriptor.shape.polygons.length,1,`${name}: one plate`);assert.equal(rings.length,2,`${name}: outline and pin bore only`);
    const ring=rings[0].slice(0,-1),n=ring.length;
    // Smooth outline: no corner turns more than 25 degrees between segments.
    let sharpest=0;
    for(let i=0;i<n;i++){
      const a=ring[(i+n-1)%n],b=ring[i],c=ring[(i+1)%n],u1=[b[0]-a[0],b[1]-a[1]],u2=[c[0]-b[0],c[1]-b[1]];
      sharpest=Math.max(sharpest,Math.abs(Math.atan2(u1[0]*u2[1]-u1[1]*u2[0],u1[0]*u2[0]+u1[1]*u2[1])));
    }
    assert.ok(sharpest<25*Math.PI/180,`${name}: outline has a ${sharpest} rad corner`);
    // Seated: the nose touches both valley walls at the hold.
    const s=u.stateAtTime(time),center=kind==='B'?s.B.center:s.H.center,
      local=[center[0]*Math.cos(-s.wheelAngle)-center[1]*Math.sin(-s.wheelAngle),center[0]*Math.sin(-s.wheelAngle)+center[1]*Math.cos(-s.wheelAngle)],
      [face,back]=walls(local,u.profile.points);
    near(face.distance,p.noseRadius,2e-4);near(back.distance,p.noseRadius,2e-4);
    // The tip is a wedge within 9 degrees of each wall: plate points just
    // behind the nose on each side lie close to the walls, not a needle.
    const noseLocal=kind==='B'?[p.VB[0]*Math.cos(p.sourceBarAngle)-p.VB[1]*Math.sin(p.sourceBarAngle),p.VB[0]*Math.sin(p.sourceBarAngle)+p.VB[1]*Math.cos(p.sourceBarAngle)]
      :[p.VH[0]*Math.cos(p.sourceHAngle)-p.VH[1]*Math.sin(p.sourceHAngle),p.VH[0]*Math.sin(p.sourceHAngle)+p.VH[1]*Math.cos(p.sourceHAngle)];
    const dense=ring.flatMap((a,i)=>{const b=ring[(i+1)%n],k=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.002);
      return Array.from({length:k},(_,j)=>[a[0]+(b[0]-a[0])*j/k,a[1]+(b[1]-a[1])*j/k]);});
    const width=dense.filter(q=>Math.abs(Math.hypot(q[0]-noseLocal[0],q[1]-noseLocal[1])-.06)<.01);
    let spread=0;for(const a of width)for(const b of width)spread=Math.max(spread,Math.hypot(a[0]-b[0],a[1]-b[1]));
    assert.ok(spread>.03,`${name}: tip is ${spread} wide 0.06 behind the nose`);
    // Consistent working thickness: away from the boss and the tip wedge, the
    // nearest point across the plate (more than 0.12 away along the outline)
    // is at least 0.085 away.
    const along=[0];for(let i=1;i<dense.length;i++)along.push(along[i-1]+Math.hypot(dense[i][0]-dense[i-1][0],dense[i][1]-dense[i-1][1]));
    const perimeter=along.at(-1);let minimum=Infinity;
    for(let i=0;i<dense.length;i+=3){
      const q=dense[i];if(Math.hypot(q[0]-noseLocal[0],q[1]-noseLocal[1])<.16||Math.hypot(...q)<.13)continue;
      for(let j=0;j<dense.length;j++){const gap=Math.abs(along[j]-along[i]);if(Math.min(gap,perimeter-gap)<.12)continue;
        minimum=Math.min(minimum,Math.hypot(dense[j][0]-q[0],dense[j][1]-q[1]));}
    }
    assert.ok(minimum>.085,`${name}: thinnest section ${minimum}`);
  }
  dispose(model);
});
