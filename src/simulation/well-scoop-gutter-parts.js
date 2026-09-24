import * as THREE from 'three';
import {plate,poly,circle,capsule,ring,polygonClipping as clip} from './finite-plate-geometry.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {boredJournal,fitPistonGuide} from './piston-guide-parts.js';
import {horizontalTurned} from './horizontal-turbine-solids.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {makeCellWaterGeometry,updateClippedCell} from './clipped-fluid-cell.js';
import {helicalThread,threadAngles} from './mujoco-screw/thread-geometry.js';
const replace=(mesh,g)=>{mesh.geometry.dispose();mesh.geometry=g;};
const add=(parent,g,material,role)=>{const o=new THREE.Mesh(g,material);o.userData.role=role;parent.add(o);return o;};

export function correctWaterLiftParts(root,id) {
  const d=root.userData,b=d.blocks,g=d.geometry;
  if(id===459) {
    for(const assembly of [b.leftAssembly,b.rightAssembly]) {
      const pulley=assembly.pulley,R=g.pulleyRadius,profile=[{axial:-.135,radial:R+.03},{axial:-.050,radial:R+.03}];
      for(let i=0;i<=32;i++){const z=-.044+.088*i/32;profile.push({axial:z,radial:R-Math.sqrt(Math.max(0,.044**2-z*z))});}
      profile.push({axial:.050,radial:R+.03},{axial:.135,radial:R+.03});
      replace(pulley.userData.tread,boredLatheGeometry(profile,R*.80,128));
      replace(pulley.userData.hub,boredLatheGeometry([{axial:-.19575,radial:R*.26},{axial:.19575,radial:R*.26}],.104,64));
      for(const o of pulley.userData.rotor.children)if(o.geometry?.type==='TorusGeometry')o.visible=false;
      // Brown draws no white index patches; the ropes run over the tread one.
      for(const o of [...pulley.userData.rotor.children])if(o.geometry?.type==='BoxGeometry'&&o.material?.color?.getHex()===0xfaf9f5){o.removeFromParent();o.geometry.dispose();o.material.dispose();}
      const journal=boredJournal(.18,.104,.18,b.base.material);journal.position.copy(assembly.axle.position);journal.position.z=.29;root.add(journal);
    }
    for(const bucket of [b.leftBucket,b.rightBucket]) {
      const p=bucket.body.geometry.parameters;
      replace(bucket.body,horizontalTurned([[-p.height/2,p.radiusBottom], [p.height/2,p.radiusTop], [p.height/2,p.radiusTop-.03],[-p.height/2,p.radiusBottom-.03]]));
    }
    const profile={inner:g.wormPitchRadius*.68,outer:g.wormPitchRadius+.045,low:-g.wormLength/2,high:g.wormLength/2,width:.080,phase:-g.wormLength/2,lead:g.axialPitch/(2*Math.PI)};
    replace(b.worm.userData.thread,helicalThread(profile,threadAngles(profile,96)));
    b.worm.userData.threadCaps.forEach(o=>o.visible=false);
    // The step lies wholly below the worm's lower end (it had enclosed it).
    replace(b.selectorBearing,horizontalTurned([[-.11,.080],[-.11,.17],[-.006,.17],[-.006,.080]]));
    d.updateSolids=state=>{b.selectorBearing.rotation.z=state.carrierAngle;};
    for(const [trough,sign]of [[b.leftTrough,-1],[b.rightTrough,1]]){trough.position.x=sign*2.64;trough.position.y=-.80;trough.rotation.z=0;}
    b.well.material.opacity=.10;
    d.solidReview={status:'partial',residual:'Finite buckets, closed thread, lower journal and tangent rope/groove path corrected. Worm wheel contact and bucket-driven selector/tipping remain prescribed and are not contact-qualified.'};
  } else if(id===460) {
    const material=b.leftBank.material;
    b.base.position.y=-2.35;
    replace(b.deliveryChannel,new THREE.BoxGeometry(1.90,.18,1.0));b.deliveryChannel.position.set(-3.15,-.26,0);
    b.deliveryWater.position.set(-3.15,-.14,0);
    replace(b.deliveryWater,new THREE.BoxGeometry(1.80,.055,.84));
    replace(b.leftBank,plate(poly([[-4.225,-2.42],[-4.225,.02],[-2.59,.02],[-1.92,-2.42]]),-1.275,1.275));b.leftBank.position.set(0,0,0);
    replace(b.rightBank,plate(poly([[1.5,-2.42],[1.25,.9],[3.675,.9],[3.675,-2.42]]),-1.275,1.275));b.rightBank.position.set(0,0,0);
    b.basin.visible=false;
    const outline=poly([[.02,.12],[2.82,-.31],[3.43,-.08],[3.24,-.92],[2.56,-1.20],[1.78,-.88],[.02,-.10]]);
    const bosses=clip.union(outline,poly(circle([0,0],.23,64)),poly(circle([g.scoopConnectionRadius,0],.18,64)),poly([[g.scoopConnectionRadius-.12,-.45],[g.scoopConnectionRadius+.12,-.45],[g.scoopConnectionRadius+.12,0],[g.scoopConnectionRadius-.12,0]]));
    const bored=clip.difference(bosses,poly(circle([0,0],.164,64)),poly(circle([g.scoopConnectionRadius,0],.064,64)));
    for(const side of b.scoopSidePlates)replace(side,plate(bored,-.04,.04));
    replace(b.scoopConnectionPin,new THREE.CylinderGeometry(.06,.06,1.28,48));
    const upper=b.beam.children.find(o=>o.userData.role==='pitman-pin-seated-in-selected-beam-notch');
    replace(upper,new THREE.CylinderGeometry(.06,.06,1.28,48));
    const beamOutline=poly([[-.505,-.125],[2.345,-.125],[2.345,.125],[-.505,.125]]);
    const notches=g.notchRadii.map(r=>clip.union(poly(circle([r,0],.065,64)),poly([[r-.065,-.2],[r+.065,-.2],[r+.065,0],[r-.065,0]])));
    const beamBored=clip.difference(clip.union(beamOutline,poly(circle([0,0],.25,64))),poly(circle([0,0],.174,64)),...notches);
    replace(b.beamBody,plate(beamBored,-.275,.275));b.beamBody.position.x=0;
    b.beam.children[1].visible=false;b.notches.forEach(o=>o.visible=false);
    for(let i=0;i<b.pitmanBars.length;i++) {
      const bar=b.pitmanBars[i],l=g.pitmanLength;
      const geom=boredPlanarLinkGeometry({length:l,width:.12,eyeRadius:.125,boreRadius:.064,depth:.09});
      geom.translate(-l/2,0,0).rotateZ(Math.PI/2).scale(1,1/l,1);replace(bar,geom);bar.position.z=i? .53:-.53;
    }
    b.beamPedestal.visible=false;
    b.journals=[];
    for(const [pivot,shaftRadius,z] of [[g.scoopPivot,.16,.57],[g.beamPivot,.17,.46]])for(const sign of [-1,1]) {
      const journal=boredJournal(shaftRadius+.09,shaftRadius+.004,.14,material);journal.position.copy(pivot);journal.position.z=sign*z;root.add(journal);b.journals.push(journal);
      const height=pivot===g.scoopPivot?1.45:.18;
      const pedestal=add(root,new THREE.BoxGeometry(.32,height,.16),material,'fixed-trunnion-standard');pedestal.position.copy(journal.position);pedestal.position.y-=shaftRadius+.03+height/2;b.journals.push(pedestal);
    }
    replace(b.scoopWater,makeCellWaterGeometry());
    d.updateSolids=state=>updateClippedCell(b.scoopWater,[[1.82,-.82],[2.56,-1.14],[3.18,-.88],[3.26,-.60],[1.65,-.60]],state.scoopAngle,state.waterFraction,.42,.66);
    d.solidReview={status:'qualified-geometry',residual:'Exact four-bar law retained; adjustment is assembly selection, and engine forcing and fluid volumes remain prescribed.'};
  } else if(id===461) {
    const material=b.branchAssemblies[0].floor.material,wallMaterial=b.branchAssemblies[0].rails[0].material;
    const segments=g.localPathPoints.slice(0,-1).map((p,i)=>[p.toArray().slice(0,2),g.localPathPoints[i+1].toArray().slice(0,2)]);
    const boxes=g.junctionLocalPoints.map(p=>[p.x,p.y]);
    const square=(p,r)=>poly([[p[0]-r,p[1]-r],[p[0]+r,p[1]-r],[p[0]+r,p[1]+r],[p[0]-r,p[1]+r]]);
    const inside=clip.union(...segments.map(([a,c])=>capsule(a,c,.15,12)),...boxes.map(p=>square(p,.30)));
    const outside=clip.union(...segments.map(([a,c])=>capsule(a,c,.185,12)),...boxes.map(p=>square(p,.335)));
    // Open ends are cut beyond their terminal planes, while all elbow branches
    // communicate through finite chambers rather than solid translucent cubes.
    const openEnds=[g.localPathPoints[0],g.localPathPoints.at(-1)].map(p=>poly(circle([p.x,p.y],.20,64)));
    const walls=clip.difference(outside,inside,...openEnds);
    b.conduitBack=add(b.swingingGutter,plate(outside,-.22,-.18),material,'finite-connected-gutter-back-wall');
    b.conduitWalls=add(b.swingingGutter,plate(walls,-.18,.18),wallMaterial,'finite-gutter-and-ported-junction-side-walls');
    for(const branch of b.branchAssemblies){branch.floor.visible=false;branch.rails.forEach(o=>o.visible=false);}
    b.valveBoxes.forEach(o=>o.visible=false);b.outletMouth.visible=false;
    for(let i=0;i<b.flaps.length;i++) {
      const {flap,mount}=b.flaps[i],theta=mount.rotation.z,p=g.junctionLocalPoints[i];
      mount.position.set(p.x-.08*Math.cos(theta)-.135*Math.sin(theta),p.y-.08*Math.sin(theta)+.135*Math.cos(theta),0);
      const face=clip.difference(clip.union(poly([[-.02,0],[.02,0],[.02,-.27],[-.02,-.27]]),poly(circle([0,0],.05,48))),poly(circle([0,0],.030,48)));
      replace(flap,plate(face,-.10,.10));flap.position.set(0,0,0);
      const pin=add(mount,new THREE.CylinderGeometry(.027,.027,.44,32),wallMaterial,'fixed-elbow-flap-hinge');pin.rotation.x=Math.PI/2;pin.position.z=-.01;
    }
    const lean=([x,y])=>[x-(g.stackLean??0)*y,y];
    const spine=clip.difference(clip.union(capsule(lean([-1.3,-2.55]),lean([1.4,2.75]),.07,32),poly(circle([0,0],.24,64))),poly(circle([0,0],.164,64)));
    b.spine=add(b.swingingGutter,plate(spine,-.31,-.20),wallMaterial,'bored-rigid-gutter-back-spine');
    replace(b.pivotAxle,new THREE.CylinderGeometry(.16,.16,.66,48));b.pivotAxle.position.z=-.56;
    b.journal=boredJournal(.25,.164,.20,b.base.material);b.journal.position.copy(g.gutterPivot);b.journal.position.z=-.70;root.add(b.journal);
    const scoopParts=b.bottomScoop.children;
    replace(scoopParts[0],new THREE.BoxGeometry(.68,.40,.04));scoopParts[0].position.z=-.20;
    for(let i=1;i<3;i++) {
      replace(scoopParts[i],new THREE.BoxGeometry(.68,.04,.40));
      const offset=i===1?-.22:.22,angle=scoopParts[i].rotation.z;
      scoopParts[i].position.set(-.16-Math.sin(angle)*offset,Math.cos(angle)*offset,0);
    }
    b.reservoirRim.visible=false;b.reservoirOpening.visible=false;
    b.base.position.y=-2.60;
    replace(b.reservoir,new THREE.BoxGeometry(7.2,1.15,2.5));b.reservoir.position.y=g.reservoirSurfaceY-.575;

    d.solidReview={status:'qualified-geometry',residual:'Finite connected open channels and in-passage flap hinges; swing, flap opening and water transport remain prescribed, without valve-force or hydraulic rectification validation.'};
  }
  d.minimumDisplayCycleSeconds=g.cycleDuration;
  fitPistonGuide(root,d.update,g.cycleDuration);
  d.cameraDirection=new THREE.Vector3(2.1,1.8,14);
}
