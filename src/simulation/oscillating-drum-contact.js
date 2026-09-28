// Ideal one-way capture with a prescribed positive coast speed. This is a
// kinematic impact/coast reconstruction, not an inertia or torque solution.
export const drumContact = { period:6, amplitude:.38*1.55/.64, coastSpeed:.20, pitch:2*Math.PI/20, advance:7*2*Math.PI/20, lockPhase:2.46, pivotRadius:.53, pivotPhase:1.96, rollerRadius:.035, faceRadius:.375, rootRadius:.29, tipRadius:.38 };
// Brown's ratchet has twenty teeth; seven pass per beam oscillation, so the ratchet repeats every oscillation and the four-spoked flywheel every five (30 s).
drumContact.toothCount=Math.round(2*Math.PI/drumContact.pitch);
const p=drumContact,w=2*Math.PI/p.period;

const angle=t=>-p.amplitude*Math.cos(w*t),speed=t=>p.amplitude*w*Math.sin(w*t);
p.releaseTime=(Math.PI-Math.asin(p.coastSpeed/(p.amplitude*w)))/w;
p.startAngle=angle(p.releaseTime)+p.lockPhase+p.coastSpeed*(p.period-p.releaseTime)-p.advance;
let lo=0,hi=p.releaseTime;for(let i=0;i<54;i++){const t=(lo+hi)/2;if(p.startAngle+p.coastSpeed*t-angle(t)>p.lockPhase)lo=t;else hi=t;}p.catchTime=(lo+hi)/2;
p.pivot=[p.pivotRadius*Math.cos(p.pivotPhase),p.pivotRadius*Math.sin(p.pivotPhase)];
p.seatedCenter=[p.faceRadius*Math.cos(p.lockPhase)+p.rollerRadius*Math.sin(p.lockPhase),p.faceRadius*Math.sin(p.lockPhase)-p.rollerRadius*Math.cos(p.lockPhase)];
p.length=Math.hypot(p.seatedCenter[0]-p.pivot[0],p.seatedCenter[1]-p.pivot[1]);p.base=Math.atan2(p.seatedCenter[1]-p.pivot[1],p.seatedCenter[0]-p.pivot[0]);
p.profile=[[p.rootRadius,0],[p.tipRadius,0],[p.rootRadius*Math.cos(.92*p.pitch),p.rootRadius*Math.sin(.92*p.pitch)]];
export function drumContactState(time){const k=Math.floor(time/p.period),t=time-k*p.period,locked=t>=p.catchTime&&t<=p.releaseTime;let a,v;if(t<p.catchTime){a=p.startAngle+p.coastSpeed*t;v=p.coastSpeed;}else if(locked){a=angle(t)+p.lockPhase;v=speed(t);}else{a=angle(p.releaseTime)+p.lockPhase+p.coastSpeed*(t-p.releaseTime);v=p.coastSpeed;}return{angle:k*p.advance+a,speed:v,locked,localTime:t,relativeAngle:a-angle(t)};}
