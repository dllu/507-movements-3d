import * as THREE from 'three';
import {waterVolumeMaterial} from './water-volume.js';
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
    b.base.position.y=-2.49; // top flush with the pit floor and bank feet (-2.42)
    // Pass 69 (p69-w1): Brown's left bank is a narrow ridge carrying the
    // trunnion between the pit and the brimming upper channel on its far
    // side; the scoop's spout reaches over the ridge into that channel. (The
    // channel and its water had been buried inside a solid bank.)
    const ridgeTop=-.55,ridgeLeft=-2.75,pitTop=-2.2,channelFloor=-1.4,channelSurface=-.60,slopeFoot=-3.05;
    // The old raised channel box is not drawn; its (hidden) block now lies
    // in the channel floor, clear of the spout's sweep.
    replace(b.deliveryChannel,new THREE.BoxGeometry(1.1,.05,2.4));b.deliveryChannel.position.set(-3.65,channelFloor-.03,0);b.deliveryChannel.visible=false;
    replace(b.leftBank,plate(poly([[-4.225,-2.42],[-4.225,channelFloor],[slopeFoot,channelFloor],[ridgeLeft,ridgeTop],[pitTop,ridgeTop],[-1.92,-2.42]]),-1.275,1.275));b.leftBank.position.set(0,0,0);
    {const x=slopeFoot+(ridgeLeft-slopeFoot)*(channelSurface-channelFloor)/(ridgeTop-channelFloor)-.004;
     replace(b.deliveryWater,plate(poly([[-4.225,channelFloor+.004],[slopeFoot-.004,channelFloor+.004],[x,channelSurface],[-4.225,channelSurface]]),-1.2,1.2));
     b.deliveryWater.position.set(0,0,0);b.deliveryWater.material=waterVolumeMaterial();b.deliveryWater.renderOrder=1;b.deliveryWater.userData.role='upper-channel-water-at-delivery-level';}
    replace(b.rightBank,plate(poly([[1.5,-2.42],[1.25,.9],[3.675,.9],[3.675,-2.42]]),-1.275,1.275));b.rightBank.position.set(0,0,0);
    b.basin.visible=false;
    // The basin water between the two banks, from its surface to the floor
    // (it was a thin surface sheet).
    {const top=-1.27,left=y=>-2.2+.28*(-.55-y)/1.87,right=y=>1.25+.25*(.9-y)/3.32;
     replace(b.basinWater,plate(poly([[left(-2.42),-2.42],[right(-2.42),-2.42],[right(top),top],[left(top),top]]),-1.2,1.2));b.basinWater.position.set(0,0,0);b.basinWater.material=waterVolumeMaterial();b.basinWater.renderOrder=1;}
    const outline=poly([[-.62,-.06],[.02,.12],[2.82,-.31],[3.43,-.08],[3.24,-.92],[2.56,-1.20],[1.78,-.88],[.12,-.31],[-.62,-.31]]);
    const bosses=clip.union(outline,poly(circle([0,0],.23,64)),poly(circle([g.scoopConnectionRadius,0],.18,64)),poly([[g.scoopConnectionRadius-.12,-.45],[g.scoopConnectionRadius+.12,-.45],[g.scoopConnectionRadius+.12,0],[g.scoopConnectionRadius-.12,0]]));
    const bored=clip.difference(bosses,poly(circle([0,0],.164,64)),poly(circle([g.scoopConnectionRadius,0],.064,64)));
    for(const side of b.scoopSidePlates)replace(side,plate(bored,-.04,.04));
    replace(b.scoopConnectionPin,new THREE.CylinderGeometry(.06,.06,1.28,48));
    const upper=b.beam.children.find(o=>o.userData.role==='pitman-pin-seated-in-selected-beam-notch');
    replace(upper,new THREE.CylinderGeometry(.06,.06,1.28,48));
    // Pass 69: the tail past the pivot is short, so it clears the bank top
    // through the full-drain stroke.
    const beamOutline=poly([[-.27,-.125],[2.345,-.125],[2.345,.125],[-.27,.125]]);
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
      const height=pivot===g.scoopPivot?g.scoopPivot.y-shaftRadius-.03+.55:.18; // down to the ridge top
      const pedestal=add(root,new THREE.BoxGeometry(.32,height,.16),material,'fixed-trunnion-standard');pedestal.position.copy(journal.position);pedestal.position.y-=shaftRadius+.03+height/2;b.journals.push(pedestal);
    }
    replace(b.scoopWater,makeCellWaterGeometry());
    d.updateSolids=state=>updateClippedCell(b.scoopWater,[[1.82,-.82],[2.56,-1.14],[3.18,-.88],[3.26,-.60],[1.65,-.60]],state.scoopAngle,state.waterFraction,.42,.66);
    d.solidReview={status:'qualified-geometry',residual:'Exact four-bar law retained; adjustment is assembly selection, and engine forcing and fluid volumes remain prescribed.'};
  }
  d.minimumDisplayCycleSeconds=g.cycleDuration;
  fitPistonGuide(root,d.update,g.cycleDuration);
  d.cameraDirection=new THREE.Vector3(2.1,1.8,14);
}
