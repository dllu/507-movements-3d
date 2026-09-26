import profile from '../data/crossed-rack-profile.js';
import returnStroke from '../data/crossed-rack-return.js';

// The recorded run lifts the rack for 18 physical seconds and ends with the
// lever at the top of its swing. To loop without a jump the lever keeps
// swinging for three quarters of a cycle, back to its starting pose and speed.
// Meanwhile the rack is eased off the loaded hook, both hooks swing clear, the
// rack is let down a little below its start, the hooks return beneath their
// teeth and the rack settles onto them. The hooks' outward swing is generated
// against the rendered solids (scripts/generate-crossed-rack-return.mjs). This
// return is a reconstruction for the demonstration; only the lift is recorded
// dynamics.
export const CROSSED_RACK_RETURN = returnStroke;

const smooth = x => {const s = Math.max(0, Math.min(1, x)); return s * s * s * (10 - 15 * s + 6 * s * s);};
const ramp = (x, [a, b]) => smooth((x - a) / (b - a));

function recordedState(physicsTime) {
 const rows = profile.rows;
 let low = 0, high = rows.length - 1;
 while (high - low > 1) {const middle = (low + high) >> 1; if (rows[middle][0] <= physicsTime) low = middle; else high = middle;}
 const a = rows[low], b = rows[high], fraction = Math.max(0, Math.min(1, (physicsTime - a[0]) / (b[0] - a[0])));
 return {x: a.slice(1).map((v, i) => v + fraction * (b[i + 1] - v)), v: a.slice(1).map((v, i) => (b[i + 1] - v) / (b[0] - a[0]))};
}
const recordedEnd = recordedState(returnStroke.start).x;

function returnState(physicsTime) {
 const {plan, rows, start, duration} = returnStroke, s = Math.max(0, Math.min(1, (physicsTime - start) / duration));
 const rackY = (recordedEnd[0] + plan.lift * ramp(s, plan.raise)) * (1 - ramp(s, plan.lower))
  - plan.dip * ramp(s, plan.lower) * (1 - ramp(s, plan.settle));
 const i = Math.min(rows.length - 2, Math.floor(s * (rows.length - 1))), a = rows[i], b = rows[i + 1],
  f = Math.max(0, Math.min(1, (s - a[0]) / (b[0] - a[0]))), settle = smooth(s);
 return [rackY, recordedEnd[1] * (1 - settle) + a[1] + f * (b[1] - a[1]), recordedEnd[2] * (1 - settle) + a[2] + f * (b[2] - a[2])];
}

export function sampleCrossedRackMotion(time,{period=profile.playbackPeriod}={}){
 if(!Number.isFinite(time)||!Number.isFinite(period)||period<=0)throw Error('Invalid playback time or period');
 const rate=profile.physicsPeriod/period,loop=returnStroke.start+returnStroke.duration,
  unwrapped=Math.max(0,time)*rate,physicsTime=unwrapped-Math.floor(unwrapped/loop)*loop,p=profile.physics,
  returning=physicsTime>returnStroke.start;
 let x,v;
 if(!returning){const recorded=recordedState(physicsTime);x=recorded.x;v=recorded.v.map(value=>value*rate);}
 else{const h=1e-4,a=Math.max(returnStroke.start,physicsTime-h),b=Math.min(loop,physicsTime+h),ahead=returnState(b),behind=returnState(a);
  x=returnState(physicsTime);v=x.map((_,i)=>(ahead[i]-behind[i])/(b-a)*rate);}
 const q=p.amplitude*Math.sin(p.omega*physicsTime),qVelocity=rate*p.amplitude*p.omega*Math.cos(p.omega*physicsTime);
 return{q,rackY:x[0],leftAngle:x[1],rightAngle:x[2],rackVelocity:v[0],angularVelocities:[qVelocity,v[1],v[2]],
  physicsTime,period,duration:loop/rate,finished:false,inputStopped:false,returning};
}
