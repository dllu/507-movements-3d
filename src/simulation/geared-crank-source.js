import {Vector2} from 'three';
// Approximate landmarks in the original 525px engraving. Moving the upper
// joint 14px right makes the inferred four-bar capable of a full input turn.
export const gearedCrankSource={scale:.028,center:[263,288],eccentric:[212,264],
 drawnJoint:[247,228],joint:[261,228],pivot:[469,258],period:8};
const g=gearedCrankSource;
export const sourcePoint=p=>new Vector2((p[0]-g.center[0])*g.scale,(g.center[1]-p[1])*g.scale);
const a=sourcePoint(g.eccentric),b=sourcePoint(g.joint),pivot=sourcePoint(g.pivot);
export const gearedCrankLengths={input:a.length(),coupler:a.distanceTo(b),output:b.distanceTo(pivot),ground:pivot.length()};
export function gearedCrankState(time){
 const theta=Math.atan2(a.y,a.x)-2*Math.PI*time/g.period;
 const wrist=new Vector2(Math.cos(theta),Math.sin(theta)).multiplyScalar(gearedCrankLengths.input);
 const delta=pivot.clone().sub(wrist),distance=delta.length(),unit=delta.multiplyScalar(1/distance);
 const along=(gearedCrankLengths.coupler**2-gearedCrankLengths.output**2+distance**2)/(2*distance);
 const heightSquared=gearedCrankLengths.coupler**2-along**2;
 if(heightSquared<0)throw new Error('Source reconstruction does not close');
 const joint=wrist.clone().addScaledVector(unit,along).addScaledVector(new Vector2(-unit.y,unit.x),Math.sqrt(heightSquared));
 return {time,theta,wrist,joint,pivot:pivot.clone(),couplerAngle:Math.atan2(joint.y-wrist.y,joint.x-wrist.x),
  rockerAngle:Math.PI+Math.atan2(pivot.y-joint.y,pivot.x-joint.x),closureHeight:Math.sqrt(heightSquared)};
}
