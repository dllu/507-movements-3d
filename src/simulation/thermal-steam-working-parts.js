import * as THREE from 'three';
import {circle,poly,plate,ring,turned,sector,polygonClipping} from './finite-plate-geometry.js';
import {curvedPipeWall,mergePassageParts} from './finite-fluid-passages.js';
import {helicalThread,threadAngles} from './mujoco-screw/thread-geometry.js';

const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const finish=root=>{const d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=Math.max(6,d.geometry.cycleDuration);root.traverse(o=>{for(const m of o.material?[].concat(o.material):[])m.fog=false;});};

// Six annular cube-sphere patches share their outer edges. The inner edges
// form genuine cylindrical ports through a finite spherical shell.
export function sixPortSphere(outer,inner,axialBore,radialBore,offset=0){
  const positions=[],indices=[],n=64,rows=20;
  const bases=[[[1,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,1,0],[0,0,-1]],[[0,1,0],[0,0,1],[1,0,0]],[[0,-1,0],[0,0,1],[-1,0,0]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[1,0,0],[0,-1,0]]];
  for(let face=0;face<6;face++){
    const [normal,u,v]=bases[face].map(p=>new THREE.Vector3(...p).applyAxisAngle(new THREE.Vector3(1,0,0),offset)),bore=face<2?axialBore:radialBore,base=positions.length/3;
    for(const radius of [outer,inner])for(let row=0;row<=rows;row++)for(let j=0;j<n;j++){
      const a=j*2*Math.PI/n,c=Math.cos(a),s=Math.sin(a),edge=Math.atan(1/Math.max(Math.abs(c),Math.abs(s))),theta=THREE.MathUtils.lerp(Math.asin(bore/radius),edge,row/rows);
      const p=normal.clone().multiplyScalar(radius*Math.cos(theta)).addScaledVector(u,radius*Math.sin(theta)*c).addScaledVector(v,radius*Math.sin(theta)*s);positions.push(...p.toArray());
    }
    const layer=(rows+1)*n;
    for(let r=0;r<rows;r++)for(let j=0;j<n;j++){
      const a=base+r*n+j,b=base+r*n+(j+1)%n,c=b+n,d=a+n;
      indices.push(a,d,c,a,c,b,a+layer,b+layer,c+layer,a+layer,c+layer,d+layer);
    }
    for(let j=0;j<n;j++){const a=base+j,b=base+(j+1)%n;indices.push(a,b,b+layer,a,b+layer,a+layer);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function correctAeolipile(root){
  const d=root.userData,b=d.blocks,g=d.geometry;
  const nozzlePortOffset=g.sourcePoseNozzleOffset-Math.asin(.30/g.globeRadius);
  replace(b.globe,sixPortSphere(g.globeRadius,g.globeRadius-.07,.085,.092,nozzlePortOffset));
  for(let i=0;i<2;i++){
    const side=i?1:-1,start=new THREE.Vector3(side*.67,.30,0),corner=new THREE.Vector3(side*1.55,g.globeCenter.y,0);
    const bend=new THREE.CurvePath();
    bend.add(new THREE.LineCurve3(start,new THREE.Vector3(side*.67,.70,0)));
    bend.add(new THREE.CubicBezierCurve3(new THREE.Vector3(side*.67,.70,0),new THREE.Vector3(side*.67,1.02,0),new THREE.Vector3(side*1.80,.76,0),new THREE.Vector3(side*1.80,1.08,0)));
    bend.add(new THREE.LineCurve3(new THREE.Vector3(side*1.80,1.08,0),new THREE.Vector3(side*1.80,2.42,0)));
    bend.add(new THREE.CubicBezierCurve3(new THREE.Vector3(side*1.80,2.42,0),new THREE.Vector3(side*1.80,2.60,0),new THREE.Vector3(side*1.72,2.72,0),corner));
    const neck=new THREE.LineCurve3(new THREE.Vector3(side*1.48,g.globeCenter.y,0),new THREE.Vector3(side*1.08,g.globeCenter.y,0));
    const full=new THREE.CurvePath();full.add(bend);full.add(new THREE.LineCurve3(corner,g.globeCenter.clone()));d.flowPaths.feedCurves[i]=full;
    const reducer=turned([[1.48,.055],[1.48,.075],[1.55,.13],[1.55,.09]],128).rotateY(side*Math.PI/2).translate(0,g.globeCenter.y,0);
    replace(b.fixedFeedPipes[i],mergePassageParts([curvedPipeWall(bend,.09,.13,112),reducer,curvedPipeWall(neck,.055,.075,8)]));
    replace(b.fixedFeedSteamCores[i],new THREE.TubeGeometry(full,128,.045,12,false));
    const collar=b.stationaryBearingCollars[i],trunnion=b.rotatingTrunnions[i];
    replace(collar,ring(.154,.205,-.095,.095,128).rotateX(-Math.PI/2));
    replace(trunnion,ring(.081,.15,-g.globeRadius*.27/2,g.globeRadius*.27/2,128).rotateX(-Math.PI/2));
  }
  for(let i=0;i<b.nozzlePipes.length;i++){
    const angle=g.sourcePoseNozzleOffset+i*g.nozzlePitch,radial=new THREE.Vector3(0,Math.cos(angle),Math.sin(angle)),tangent=new THREE.Vector3(0,-Math.sin(angle),Math.cos(angle));
    const elbowCenter=radial.clone().multiplyScalar(g.nozzleOrbitRadius-.30),curve=new THREE.CurvePath();
    curve.add(new THREE.LineCurve3(radial.clone().multiplyScalar(g.nozzleStartRadius).addScaledVector(tangent,-.30),elbowCenter.clone().addScaledVector(tangent,-.30)));
    const elbow=new THREE.Curve();elbow.getPoint=(t,target=new THREE.Vector3())=>target.copy(elbowCenter).addScaledVector(radial,.30*Math.cos(-Math.PI/2+t*Math.PI/2)).addScaledVector(tangent,.30*Math.sin(-Math.PI/2+t*Math.PI/2));curve.add(elbow);
    replace(b.nozzlePipes[i],curvedPipeWall(curve,.069,.112,112));b.nozzlePipes[i].userData.flowCurve=curve;
    replace(b.nozzleSteamCores[i],new THREE.TubeGeometry(curve,112,.047,12,false));
  }
  for(const marker of b.feedMarkers)replace(marker,new THREE.SphereGeometry(.04,16,11));
  replace(b.pivotManifold,new THREE.CylinderGeometry(.045,.045,g.globeRadius*2.2,28));
  const bands=Array.from({length:4},(_,i)=>{const a=nozzlePortOffset+i*Math.PI/2+Math.PI/2;return sector(g.globeRadius-.03,g.globeRadius+.04,a+.12,a+Math.PI/2-.12,64);});
  replace(b.rotationBand,plate(polygonClipping.union(...bands),-.027,.027));
  const lid=polygonClipping.difference(poly(circle([0,0],1.52,256)),...[-1,1].map(side=>poly(circle([side*.67,0],.094,96))));
  replace(b.boilerLid,plate(lid,-.08,.08).rotateX(-Math.PI/2));
  const outer=[[-1.40,.48],[-1.30,.93],[-1.02,1.35],[-.53,1.58],[.08,1.61],[.38,1.51]],inner=outer.map(([y,r])=>[y+.06,r-.07]);
  replace(b.boiler,turned([[-1.40,0],...outer,...inner.reverse(),[-1.34,0]],256).rotateX(-Math.PI/2));
  d.solidReview={nozzlePortOffset,qualification:'Finite boiler, six-port hollow globe, open nozzle/riser walls and bored rotary trunnions/bearings. Supplied pressure and effective drag still determine an illustrative steady speed; boiling, leakage, seals and transient fluid dynamics are not validated.'};
  finish(root);
}

export function correctTemperatureAirMachine(root){
  const d=root.userData,b=d.blocks,g=d.geometry;
  const thread={inner:.065,outer:g.screwRadius,low:-g.screwLength/2,high:g.screwLength/2,lead:-g.screwPitch/(2*Math.PI),width:.045,phase:g.screwLength/2};
  replace(b.screwFlight,helicalThread(thread,threadAngles(thread,72)).rotateX(Math.PI/2));
  replace(b.screwBarrel,ring(.307,.355,-g.screwLength/2,g.screwLength/2,128).rotateX(-Math.PI/2));
  // Pass 69: the wheel's bored hub runs to the back rim, on the fixed stub
  // axle; six spokes carry the blades. Pass 72: it ends at the face-gear disk.
  const hubFront=-(g.faceGearBaseFace+g.faceGearDiskThickness),hubBack=g.wheelPlaneZ-.25;
  b.wheelHub.rotation.set(0,0,0);b.wheelHub.position.set(0,0,0);
  replace(b.wheelHub,ring(.06,.16,hubBack,hubFront,96));
  b.wheelSpokes=Array.from({length:6},(_,i)=>{const a=i*Math.PI/3,spoke=new THREE.Mesh(new THREE.BoxGeometry(.68,.08,.10),b.wheelRims[0].material);spoke.position.set(.47*Math.cos(a),.47*Math.sin(a),g.wheelPlaneZ);spoke.rotation.z=a;spoke.userData.role='finite-wheel-spoke-joining-hub-to-blades';b.waterWheelRotor.add(spoke);return spoke;});
  replace(b.airConduit,curvedPipeWall(d.pressurePipeCurve,g.airDuctRadius-.035,g.airDuctRadius,320,32));
  d.solidReview={qualification:'Solid Archimedean flight, finite barrel, flask-shaped air vessel (the casing enters through a fitted hole in its side), broad rigid filleted air duct and bored wheel hub on a stub axle. An enlarged finite 45-degree mitre pair at the head of the inclined shaft S and a pinion on S driving a pinion-generated face gear on the wheel’s front clear the shaft ends; their teeth and thermal motion are reconstructed. Heat transfer, buoyancy, pressure, torque and passive startup are not solved.'};
  finish(root);
}
