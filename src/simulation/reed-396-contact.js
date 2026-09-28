// Dimensionless finite reconstruction. Pure geometry shared by the offline
// continuation and its independent rendered-solid tests; no live contact solve.
//
// Layout at Brown's proportions: balance staff b stands 3.14 from escape-wheel
// staff a (1.83 tooth-tip radii; the plate measures 1.82), and the lever staff
// c 2.18 on the other side.  Balance-staff pallet j therefore reaches 1.435
// from b, and its path crosses the tooth circle almost straight, so the
// half-beat roles are assigned where a tooth can drive each receiver forward:
//  - half-beat 0 (balance swinging clockwise, lever turning anticlockwise):
//    lower pallet g unlocks, the tooth drives g (lever impulse through C, e
//    and i), and upper detent f catches the wheel;
//  - half-beat 1 (balance swinging anticlockwise): f unlocks, the released
//    tooth's locking face overtakes j, which is rising across the line of
//    centres with the tooth, and drives it (direct impulse); g catches.
// On the clockwise swing j passes back across the line of centres through
// the gap in front of the tooth locked on g.
export const reed396 = Object.freeze({
  pitch: Math.PI / 6, period: 4, leverAmplitude: Math.PI / 36, balanceAmplitude: 2 * Math.PI / 3,
  // Free-drop speed of the unloaded wheel (rad/s): fast enough for a released
  // tooth to overtake pallet j.
  freeDropSpeed: 6,
  pinOrbit: .59, balanceCenter: -3.14, leverPivot: 2.18,
  // Pallet j stands .49 rad behind roller pin i, so it crosses the line of
  // centres 28 degrees after the fork has carried the lever through.
  jOffset: -.49,
  // Lock points on the tooth-tip circle (radians): detent f above the line
  // of centres, combined lock/impulse pallet g below it.
  fAngle: 38 * Math.PI / 180, gAngle: -37 * Math.PI / 180,
  tipRadius: 1.72, rootRadius: 1.52,
  // Raked ratchet teeth: the locking face leans back from the tip by
  // .05 pitch at the root, so each pallet and j touch only the tooth point.
  lockingFaceRake: .05, backSlope: .45,
  // Lever angles (degrees) of the pallet actions, measured from the bank at
  // which each pallet locks: g locks for 2.7 degrees then its impulse face
  // carries the tooth until the lever reaches -0.5 degrees; f locks over 7.5.
  gLockTravel: 2.7, gRelease: -.5, gImpulseWheelTravel: 4, fLockTravel: 7.5,
  palletThickness: .1, lockLead: .002,
  jReach: .015, jBand: [-.03, .035], jLength: .18,
});
export const rotate396 = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const add = (a,b) => a.map((x,i)=>x+b[i]), sub = (a,b) => a.map((x,i)=>x-b[i]);
const hull = (points) => {
 const pts = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]), cross = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
 const half = (list) => { const out = []; for (const p of list) { while (out.length >= 2 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop(); out.push(p); } return out.slice(0, -1); };
 return [...half(pts), ...half([...pts].reverse())];
};
const boundingCircle = (P) => {
 let cx = 0, cy = 0; for (const q of P) { cx += q[0]; cy += q[1]; } cx /= P.length; cy /= P.length;
 let r = 0; for (const q of P) r = Math.max(r, Math.hypot(q[0] - cx, q[1] - cy)); return [cx, cy, r];
};
let cachedProfiles = null;
// Pallets are lists of convex pieces in their carrier's frame (lever C about
// staff c, or balance B about staff b).  Each locking face is the circular
// arc about staff c through the locked tooth point, so a tooth resting on it
// neither recoils nor creeps while the lever turns; it is sampled finely
// enough (sagitta < 1e-8) to be exact at the continuation tolerance.
export function reed396Profiles() {
 if (cachedProfiles) return cachedProfiles;
 const R = reed396, deg = Math.PI / 180, wheel = [], teeth = [], pallets = {};
 for (let i = 0; i < 12; i++) {
  for (const [o, r] of [[-.5, R.rootRadius], [R.lockingFaceRake, R.rootRadius], [0, R.tipRadius], [R.backSlope, R.rootRadius]]) wheel.push(rotate396([r, 0], (i + o) * R.pitch));
  teeth.push([rotate396([R.rootRadius, 0], (i + R.lockingFaceRake) * R.pitch), rotate396([R.tipRadius, 0], i * R.pitch), rotate396([R.rootRadius, 0], (i + R.backSlope) * R.pitch)]);
 }
 const pivot = [R.leverPivot, 0], tip = (a) => rotate396([R.tipRadius, 0], a), local = (p, lever) => rotate396(sub(p, pivot), -lever);
 const lockArc = (a, bank, travel, count) => {
  const ahead = sub(local(add(tip(a), rotate396([0, -1], a)), bank), local(tip(a), bank)), length = Math.hypot(...ahead);
  const face = tip(a - R.lockLead / R.tipRadius);
  return {points: Array.from({length: count + 1}, (_, k) => local(face, bank + travel * k / count)), thickness: ahead.map((x) => x / length * R.palletThickness)};
 };
 const slices = ({points, thickness}) => points.slice(0, -1).map((p, k) => [p, points[k + 1], add(points[k + 1], thickness), add(p, thickness)]);
 {
  const arc = lockArc(R.gAngle, -R.leverAmplitude, R.gLockTravel * deg, 240), corner = arc.points.at(-1);
  const release = local(tip(R.gAngle - R.gImpulseWheelTravel * deg), R.gRelease * deg);
  pallets.G = [...slices(arc), hull([corner, release, add(corner, arc.thickness), add(release, arc.thickness)])];
 }
 pallets.F = slices(lockArc(R.fAngle, R.leverAmplitude, -R.fLockTravel * deg, 480));
 const jTip = -R.balanceCenter - R.tipRadius + R.jReach, [y0, y1] = R.jBand;
 pallets.J = [[[jTip - R.jLength, y0], [jTip, y0], [jTip, y1], [jTip - R.jLength, y1]]];
 const circles = Object.fromEntries(Object.entries(pallets).map(([name, list]) => [name, list.map(boundingCircle)]));
 // Simple outlines of the same pallets for the rendered plates.
 const outline = ({points, thickness}) => [...points, ...points.map((p) => add(p, thickness)).reverse()];
 const outlines = {G: [outline(lockArc(R.gAngle, -R.leverAmplitude, R.gLockTravel * deg, 240)), pallets.G.at(-1)], F: [outline(lockArc(R.fAngle, R.leverAmplitude, -R.fLockTravel * deg, 480))], J: pallets.J};
 cachedProfiles = {wheel, teeth, pallets, circles, outlines};
 return cachedProfiles;
}
// Lever C follows roller pin i while the pin is in fork e (the slot runs
// along the lever through staff c), and rests on a banking pin l otherwise.
// The pin orbit is chosen so the pin carries the lever exactly bank to bank.
const slotAngle=beta=>Math.atan2(-reed396.pinOrbit*Math.sin(beta),reed396.leverPivot-reed396.balanceCenter-reed396.pinOrbit*Math.cos(beta));
export const reed396EngageAngle=(()=>{let a=0,b=Math.PI/2;for(let i=0;i<80;i++){const m=(a+b)/2;if(slotAngle(m)>-reed396.leverAmplitude)a=m;else b=m;}return (a+b)/2;})();
export function reed396LeverFromBalance(beta){
 if(Math.abs(beta)>=reed396EngageAngle)return {angle:-Math.sign(beta)*reed396.leverAmplitude,slope:0,engaged:false};
 const h=1e-6;return {angle:slotAngle(beta),slope:(slotAngle(beta+h)-slotAngle(beta-h))/(2*h),engaged:true};
}
// Half-beat 0 swings the balance clockwise (from +A to -A), half-beat 1 back.
export function reed396Pose(time){
 const half=Math.floor(time/2),phase=time/2-half,side=((half%2)+2)%2===0?1:-1;
 const balanceAngle=side*reed396.balanceAmplitude*Math.cos(Math.PI*phase),balanceAngularSpeed=-side*reed396.balanceAmplitude*Math.PI/2*Math.sin(Math.PI*phase);
 const lever=reed396LeverFromBalance(balanceAngle);
 return {balanceAngle,balanceAngularSpeed,balanceAcceleration:-side*reed396.balanceAmplitude*(Math.PI/2)**2*Math.cos(Math.PI*phase),leverAngle:lever.angle,leverAngularSpeed:lever.slope*balanceAngularSpeed,forkEngaged:lever.engaged};
}
// World-frame convex pieces; `names` gives each piece's pallet (0 G, 1 F, 2 J).
export function reed396Obstacles(pose,pallets=reed396Profiles().pallets){
 const out=[],names=[],circles=[],known=pallets===reed396Profiles().pallets?reed396Profiles().circles:null;
 ['G','F','J'].forEach((name,index)=>{
  const angle=name==='J'?pose.balanceAngle+reed396.jOffset:pose.leverAngle,center=name==='J'?[reed396.balanceCenter,0]:[reed396.leverPivot,0];
  pallets[name].forEach((piece,k)=>{out.push(piece.map(q=>add(rotate396(q,angle),center)));names.push(index);
   const c=known?known[name][k]:boundingCircle(piece),m=add(rotate396([c[0],c[1]],angle),center);circles.push([m[0],m[1],c[2]]);});
 });
 out.names=names;out.circles=circles;return out;
}
export function reed396ConvexGap(A,B){
 let gap=-Infinity,normal;
 for(const P of[A,B])for(let i=0;i<P.length;i++){
  const e=sub(P[(i+1)%P.length],P[i]),L=Math.hypot(...e),n=[-e[1]/L,e[0]/L];
  const pa=A.map(q=>q[0]*n[0]+q[1]*n[1]),pb=B.map(q=>q[0]*n[0]+q[1]*n[1]);
  for(const [value,sign]of[[Math.min(...pa)-Math.max(...pb),1],[Math.min(...pb)-Math.max(...pa),-1]])if(value>gap){gap=value;normal=n.map(x=>x*sign);}
 }
 return {gap,normal};
}
// Smallest separating gap between any tooth and any pallet piece.  Pieces
// whose bounding circles are farther than 0.05 from a tooth cannot set the
// minimum and are skipped.
export function reed396Contact(angle,obstacles,teeth=reed396Profiles().teeth){
 let result={gap:Infinity};
 const circles=obstacles.circles??obstacles.map(boundingCircle),names=obstacles.names??obstacles.map((_,j)=>j);
 for(let i=0;i<teeth.length;i++){
  const tri=teeth[i].map(q=>rotate396(q,angle)),tc=boundingCircle(tri);
  for(let j=0;j<obstacles.length;j++){
   const oc=circles[j];if(Math.hypot(tc[0]-oc[0],tc[1]-oc[1])-tc[2]-oc[2]>Math.min(result.gap,.05))continue;
   const c=reed396ConvexGap(tri,obstacles[j]);
   if(c.gap<result.gap){const dots=tri.map(q=>q[0]*c.normal[0]+q[1]*c.normal[1]),k=dots.indexOf(Math.min(...dots));result={...c,pallet:names[j],tooth:i,point:tri[k]};}
  }
 }
 if(result.gap===Infinity)result={gap:.05,pallet:null,tooth:null};
 return result;
}
