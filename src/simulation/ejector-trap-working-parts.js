import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalRing,horizontalTurned} from './horizontal-turbine-solids.js';
import {curvedPipeWall} from './finite-fluid-passages.js';
import {fitPistonGuide} from './piston-guide-parts.js';
import {helicalThread,threadAngles} from './mujoco-screw/thread-geometry.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const add=(parent,g,material,role)=>{const o=new THREE.Mesh(g,material);o.userData.role=role;parent.add(o);return o;};

// A closed wall around a meridian, including finite returns at the explicitly
// opened side-port cells. The openings are reconstruction dimensions, not seals.
function portedMeridian(levels,outer,inner,open=()=>false) {
  const n=128,positions=[],active=(i,j)=>j>=0&&j<levels.length-1&&!open((i+.5)*2*Math.PI/n,(levels[j]+levels[j+1])/2);
  const point=(r,y,i)=>new THREE.Vector3(r*Math.cos(i*2*Math.PI/n),y,r*Math.sin(i*2*Math.PI/n));
  const face=(p,normal)=>{if(p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).dot(normal)<0)p.reverse();for(const k of[0,1,2,0,2,3])positions.push(...p[k].toArray());};
  for(let j=0;j<levels.length-1;j++)for(let i=0;i<n;i++)if(active(i,j)) {
    const a=levels[j],b=levels[j+1],theta=(i+.5)*2*Math.PI/n;
    for(const[r,sign]of[[outer,1],[inner,-1]])face([point(r(a),a,i),point(r(a),a,i+1),point(r(b),b,i+1),point(r(b),b,i)],new THREE.Vector3(sign*Math.cos(theta),0,sign*Math.sin(theta)));
    for(const[next,y,sign]of[[j-1,a,-1],[j+1,b,1]])if(!active(i,next))face([point(inner(y),y,i),point(outer(y),y,i),point(outer(y),y,i+1),point(inner(y),y,i+1)],new THREE.Vector3(0,sign,0));
    for(const[next,k,sign]of[[(i+n-1)%n,i,-1],[(i+1)%n,i+1,1]])if(!active(next,j))face([point(inner(a),a,k),point(outer(a),a,k),point(outer(b),b,k),point(inner(b),b,k)],new THREE.Vector3(-sign*Math.sin(k*2*Math.PI/n),0,sign*Math.cos(k*2*Math.PI/n)));
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
const sweepShape=(curve,r)=>{const points=curve.getPoints(40);return clip.union(...points.slice(1).map((p,i)=>capsule([points[i].x,points[i].y],[p.x,p.y],r,12)));};

export function correctEjectorTrapParts(root,id,update) {
  const d=root.userData,b=d.blocks,g=d.geometry;
  if(id===475) {
    const steamCurve=d.flowPaths.steamPipeCurve;steamCurve.points.at(-2).set(0,.46,0);steamCurve.updateArcLengths();d.flowPaths.steamFlowCurve.updateArcLengths();
    replace(b.steamPipeCore,new THREE.TubeGeometry(steamCurve,90,.085,16,false));
    const profile=[[-1.16,.53],[-1.02,.89],[-.65,1.23],[-.08,1.38],[.48,1.30],[1.05,1.04],[1.56,.57]];
    const radius=y=>{const k=Math.max(1,profile.findIndex(p=>p[0]>=y));const[a,r]=profile[k-1],[c,s]=profile[k];return r+(s-r)*(y-a)/(c-a);};
    const levels=[...profile.map(p=>p[0]),-.20,.34].sort((a,b)=>a-b);
    replace(b.chamber,portedMeridian(levels,radius,y=>radius(y)-.065,(a,y)=>y>-.20&&y<.34&&Math.cos(a)>.976));
    replace(b.suctionPipe,horizontalRing(.40,.47,-.895,.895,64));
    replace(b.dischargePipe,horizontalRing(.47,.54,-.94,.94,64));
    replace(b.steamPipe,curvedPipeWall(d.flowPaths.steamPipeCurve,.105,.20,90,32));
    replace(b.nozzle,horizontalRing(.125,.19,-.11,.11,64));
  } else if(id===476) {
    const steamCurve=d.flowPaths.steamPipeCurve;
    for(let i=0;i<steamCurve.points.length-1;i++)steamCurve.points[i].z=i===5?-.35:-.72;
    steamCurve.points[5].set(0,.68,0);steamCurve.updateArcLengths();d.flowPaths.steamFlowCurve.updateArcLengths();replace(b.steamCore,new THREE.TubeGeometry(steamCurve,92,.070,16,false));
    const steamPort=sweepShape(new THREE.CatmullRomCurve3(steamCurve.getPoints(96).filter(p=>p.z>-.64)),.20);
    const branches=d.flowPaths.branchShellCurves;
    const outlet=new THREE.LineCurve3(new THREE.Vector3(0,1.2,0),new THREE.Vector3(0,3.42,0));
    const outside=clip.intersection(clip.union(...branches.map(c=>sweepShape(c,.46)),sweepShape(outlet,.54),...[-1,1].map(s=>poly([[s*1.38-.46,-2.86],[s*1.38+.46,-2.86],[s*1.38+.46,-2.52],[s*1.38-.46,-2.52]]))),poly([[-4,-2.86],[4,-2.86],[4,3.42],[-4,3.42]]));
    const inside=clip.union(...branches.map(c=>sweepShape(c,.38)),sweepShape(outlet,.47),...[-1,1].map(s=>poly([[s*1.38-.38,-2.9],[s*1.38+.38,-2.9],[s*1.38+.38,-2.5],[s*1.38-.38,-2.5]])),poly([[-.47,3.2],[.47,3.2],[.47,3.7],[-.47,3.7]]),steamPort);
    replace(b.suctionBranches[0],plate(clip.difference(outside,inside),-.48,.48));
    b.suctionBranches[1].visible=false;b.dischargePipe.visible=false;
    b.forkBack=add(root,plate(clip.difference(outside,steamPort),-.55,-.49),b.suctionBranches[0].material,'finite-back-of-open-fork-cutaway');
    replace(b.steamPipe,curvedPipeWall(d.flowPaths.steamPipeCurve,.092,.17,92,32));
  } else if(id===477) {
    replace(b.inletPipeA,horizontalRing(.66,.74,-1.04,1.04,64));
    replace(b.outletPipeB,horizontalRing(.68,.76,-.725,.725,64));
    // The conical shoulder reaches a conformal finite seat at the existing
    // maximum prescribed lift. It previously missed the toroidal seat entirely.
    replace(b.annularSeat,horizontalTurned([[1.10,.90],[1.70,.74],[1.70,.48],[1.50,.48],[1.10,.80]]));b.annularSeat.position.y=0;b.annularSeat.rotation.set(0,0,0);
    const outer=[[-.04,.98],[.54,.88],[.775,.80],[1.175,.48],[1.20,.40],[2.835,.40],[2.98,.36],[3.12,.22],[3.18,0]];
    const inner=[[3.12,0],[3.06,.20],[2.94,.30],[2.80,.33],[1.20,.33],[1.10,.41],[.72,.73],[.50,.81],[-.04,.91]];
    replace(b.valveStem,horizontalTurned([...outer,...inner]));b.valveStem.position.y=0;
    for(const o of[b.valveTop,b.valveShoulder,b.valveReservoir,b.valveNeck])o.visible=false;
    // Finite diaphragm thickness; its lowest point remains on the bridge as
    // the retained thermal law changes its bow by scaling about the rim.
    const lower=[],upper=[];for(let i=0;i<=48;i++){const r=.94*i/48,y=-.20*(1-(r/.94)**2)**2;lower.push([y,r]);upper.unshift([y+.012,r]);}
    replace(b.flexibleDiaphragm,horizontalTurned([...lower,...upper]));
    replace(b.bridgeCap,new THREE.SphereGeometry(.10,48,32));b.bridgeCap.position.y=-.35;
    for(const leg of b.bridgeLegs){replace(leg,new THREE.BoxGeometry(.16,1.27,.30));leg.position.y=-1.045;}
    for(const stream of b.condensateStreams)stream.visible=false;
    for(const marker of b.condensateMarkers)replace(marker,new THREE.SphereGeometry(.025,16,12));
    d.updateWorkingParts=(time,state)=>{
      const lift=state.valveLiftMetre*g.liftDisplayScaleSceneUnitPerMetre;
      const path=[[.53,3.64],[.53,2.38],[.44,1.70],[.48,1.50],[.60,1.35],[.80,1.10],[1.08,.79],[1.40,-.10],[1.29,-.92],[.95,-1.43],[.52,-1.70],[.20,-2.18],[.15,-3.10]];
      for(const k of[3,4,5]){const seat=path[k][0],y=path[k][1],valve=Math.max(.40,.80-.8*(y-lift-.775));path[k][0]=(seat+valve)/2;}
      for(let i=0;i<d.flowPaths.condensateFlowCurves.length;i++){
        const angle=Math.PI/4+i*Math.PI/2,curve=d.flowPaths.condensateFlowCurves[i];
        curve.points=path.map(([r,y])=>new THREE.Vector3(r*Math.cos(angle),y,r*Math.sin(angle)));curve.updateArcLengths();
        for(let j=0;j<g.markersPerPath;j++){const marker=b.condensateMarkers[i*g.markersPerPath+j],progress=d.flowPaths.markerProgressAtTime(time,j);marker.position.copy(curve.getPointAt(progress));marker.scale.setScalar(Math.sin(Math.PI*progress)**.55*state.flowFraction);}
      }
    };
    b.rearWall.position.z=-1.12;
    for(const wall of b.caseWalls){const p=wall.geometry.parameters;replace(wall,new THREE.BoxGeometry(wall.userData.role.includes('top-wall')?1.32:wall.userData.role.includes('bottom-wall')?1.24:p.width,p.height,2.24));}
  } else if(id===478) {
    const R=1.13,r=1.06,lo=-Math.sqrt(R*R-.50*.50),levels=[lo,-.34,.34,...Array.from({length:49},(_,i)=>lo+(R-lo)*i/48)].sort((a,b)=>a-b).filter((x,i,a)=>!i||x-a[i-1]>1e-8);
    replace(b.hollowSphereC,portedMeridian(levels,y=>Math.sqrt(Math.max(0,R*R-y*y)),y=>Math.sqrt(Math.max(0,r*r-y*y)),(a,y)=>Math.abs(y)<.34&&Math.abs(Math.cos(a))>.94));
    replace(b.sphereOutlet,horizontalRing(.42,.50,-.81,.81,64));b.sphereOutlet.position.y=-1.615;
    replace(b.pipeShell,horizontalRing(.18,.27,-g.basePipeDisplayLength/2,g.basePipeDisplayLength/2,64));
    replace(b.stuffingBody,horizontalRing(.124,.30,-.27,.27,64));
    replace(b.valveFace,new THREE.CylinderGeometry(.285,.285,.17,64));
    // Flat annular end faces express the prescribed pipe/plunger contact.
    replace(b.pipeFreeEndRim,horizontalRing(.18,.27,-.018,0,64).rotateZ(-Math.PI/2));b.pipeFreeEndRim.rotation.set(0,0,0);
    b.plungerContactPad.position.x=g.plungerExternalContactLocalX-.25;
    const rodLength=g.plungerExternalContactLocalX-.25-.17;replace(b.plungerRod,new THREE.CylinderGeometry(.12,.12,rodLength,32));b.plungerRod.position.x=.17+rodLength/2;
    const lower=b.leverD.children.find(o=>o.userData.role==='lower-arm-of-loaded-elbow-lever-D');
    const shape=clip.difference(clip.union(capsule([0,-.29],[0,-2.05],.11,24),poly(circle([0,0],.32,64))),poly(circle([0,0],.244,64)));
    replace(lower,plate(shape,-.09,.09));lower.position.set(0,0,0);lower.quaternion.identity();
    const upper=b.leverD.children.find(o=>o.userData.role==='weighted-upper-arm-of-elbow-lever-D'),direction=new THREE.Vector3(1.22,.21,0),length=direction.length();
    replace(upper,new THREE.CylinderGeometry(.13,.13,length-.30,32));upper.position.copy(direction.clone().normalize().multiplyScalar((length+.30)/2));
    const standShape=clip.difference(clip.union(poly([[-.13,-2.96],[.13,-2.96],[.13,0],[-.13,0]]),poly(circle([0,0],.32,64))),poly(circle([0,0],.244,64)));
    b.leverStand=add(root,plate(standShape,-.07,.07),b.baseRight.material,'finite-bored-lever-support');b.leverStand.position.copy(g.leverPivot);b.leverStand.position.z=-.24;
    const postTop=g.fixedStopContactPoint.y+.01,postBottom=-1.28;replace(b.stopPost,new THREE.BoxGeometry(.30,postTop-postBottom,.54));b.stopPost.position.y=(postTop+postBottom)/2;
    const local=g.stopScrewTipLocal.clone().add(new THREE.Vector3(.09*Math.cos(g.leverStopAngle),-.09*Math.sin(g.leverStopAngle),0));
    b.stopTip=add(b.leverD,new THREE.SphereGeometry(.09,48,32),b.stopScrewB.material,'rounded-stop-screw-tip-contacting-fixed-stop');b.stopTip.position.copy(local);
    replace(b.stopScrewB,new THREE.CylinderGeometry(.075,.075,-.10-local.x,32));b.stopScrewB.position.set((local.x-.10)/2,-1.94,0);
    const thread={inner:.075,outer:.095,low:local.x,high:-.10,width:.018,lead:.055/(2*Math.PI),phase:0};replace(b.screwThreadsB,helicalThread(thread,threadAngles(thread,48)).rotateY(Math.PI/2).translate(0,-1.94,0));
  }
  d.minimumDisplayCycleSeconds=g.cycleDuration;
  d.workingPartsReview={status:'bounded-finite-geometry',residual:id<477?'Steady entrainment and flow markers are prescribed; startup, condensation, losses and two-phase dynamics are not solved. The visible cutaway is not a watertight manifold qualification.':'Thermal history, quasi-static contact and discharge remain prescribed analytical models; passive valve inertia, heat transfer, leakage and transient fluid dynamics are not solved.'};
  fitPistonGuide(root,update,g.cycleDuration);
  d.cameraDirection=new THREE.Vector3(1.4,1.0,15);
}
