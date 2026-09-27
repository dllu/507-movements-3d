import * as THREE from 'three';
import profile from '../data/pump-catch-profile.js';
import {makePumpCatchGeometry} from './pump-catch-geometry.js';
import {indexPumpCatchHardware} from './pump-catch-indexed-hardware.js';
import {makePumpCatchPlayback} from './pump-catch-motion.js';
import {LaidRopeGeometry} from './laid-rope.js';
import {disk} from './finite-plate-geometry.js';

// Brown draws neither the second sheave of the input drive nor any pump
// hardware: the band's two runs leave the plate to the right and the pump
// rope drops into the plinth. The production model keeps only what explains
// the drawn motion (p60 support policy): the band runs straight on past the
// right edge and ends cleanly far beyond it, and the rope carries a plain pump rod that
// hangs below the plinth. The remote sheave, its stand and base, and the pump
// crosshead, guides, beds, hangers and barrel are not built.
const UNDRAWN_PARTS=/^(remote(?:Drive(?:Rim|Web|Hub)|InputShaft|BearingStandard|BearingLip|Base)|pump(?:Crosshead|LowerBed|Barrel(?:Gland|Foot|HangerLeft|HangerRight)?|Guide(?:Left|Right|Crossbar)|GuidePillar(?:Left|Right)))$/;
// Far enough that the cleanly capped run ends stay outside the frame of
// every orbit even at the maximum zoom-out (three times the fit distance).
export const PUMP_CATCH_BAND_END=26;
function pruneUndrawnHardware(model){
  const u=model.root.userData,removed=[];
  for(const [name,mesh] of Object.entries(u.parts))if(UNDRAWN_PARTS.test(name)){
    mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();delete u.parts[name];delete u.families[name];removed.push(name);
  }
  u.blocks.remoteInput.removeFromParent();delete u.blocks.remoteInput;
  // The pump rod now meets the rope's ferrule directly at the rope end.
  const rod=u.parts.pumpOutputRod;rod.geometry.dispose();rod.geometry=disk(.035,0,3.35,96).rotateX(Math.PI/2);
  // The endless band becomes its two open runs round A's sheave, in the
  // loop's own direction so its lay still travels with the sheave rim.
  const {radius,ropeRadius,low,high}=u.rearDrive,z=(low+high)/2,end=PUMP_CATCH_BAND_END,at=(x,y)=>new THREE.Vector3(x,y,z);
  const path=new THREE.CurvePath(),arc=new THREE.Curve();
  arc.getPoint=(t,target=new THREE.Vector3())=>{const a=-Math.PI/2-Math.PI*t;return target.set(radius*Math.cos(a),radius*Math.sin(a),z);};
  path.add(new THREE.LineCurve3(at(end,-radius),at(0,-radius)));path.add(arc);path.add(new THREE.LineCurve3(at(0,radius),at(end,radius)));
  const band=u.parts.inputDriveRope,travel=band.geometry.userData.travel??0;band.geometry.dispose();
  band.geometry=new LaidRopeGeometry(path,Math.ceil(path.getLength()*68),ropeRadius,8,false,{travel});
  u.rearDrive={...u.rearDrive,bandEnd:end,bandLength:path.getLength(),openBand:true};
  u.prunedHardware=removed;
  return removed;
}

// The studied full-motion bounds, widened only to the open band's far ends.
function bandMotionBounds(u){
  const {min,max}=profile.motionBounds,{bandEnd,ropeRadius}=u.rearDrive;
  return{min:[...min],max:[Math.max(max[0],bandEnd+ropeRadius+1e-6),max[1],max[2]]};
}

export function makePumpCatchDrive(){
  const model=makePumpCatchGeometry(),u=model.root.userData,motion=makePumpCatchPlayback(profile);
  pruneUndrawnHardware(model);
  indexPumpCatchHardware(model);
  Object.assign(u,{fidelity:'authored',mechanism:'cam-latched-loose-wheel-pump-drive',reconstructionStatus:'rebuilt',
    profile,motion,playbackPeriod:motion.displayPeriod,animationTiming:{authoredCyclePeriod:motion.displayPeriod},
    minimumDisplayCycleSeconds:motion.displayPeriod,stateAtTime:motion.sample,sampledMotionBounds:bandMotionBounds(u),kinematics:{},
    qualification:'Source-traced loose wheel, hooked catch and cam with complete winding, rear input and guided pump hardware. Motion follows the reviewed finite-contact trajectory.',
    idealConstraints:'The input shaft alone rotates continuously. Gravity, inertia, unilateral cam/catch/stop contact, a fixed-length massless rope and the guided load determine capture, lift, trip and return. The rear band, hidden winding width, head thickness, heel stop, bearing resistance, normalized load and output guides reconstruct details omitted by the engraving. The slack bow is an explicit massless display shape. Startup is retained before an eight-second physical cycle repeats in four display seconds.'});
  // Brown draws a front elevation cut at the ground line: the rope runs down
  // into the plinth and the input band's two runs leave the plate to the
  // right. The default view frames Brown's window and lets the band runs and
  // the pump rod run off its right and lower edges.
  const plinthBottom=(u.source.center[1]-u.source.base.bottom)/u.source.scale,plateRight=2.1;
  u.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-2.31,plinthBottom,-1.43),new THREE.Vector3(plateRight,2.25,.6));
  // The engine fits the plate window edge to edge; this scale on its generic
  // distance keeps the overhead beam and left post clear of the view edges.
  u.cameraDistanceScale=6;
  model.update=time=>{const state=motion.sample(time);model.setState(state);Object.assign(u.kinematics,state);};
  model.update(0);return model;
}
