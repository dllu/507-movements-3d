// Approximate pixel landmarks from the 525px engraving.
export const twinCamSource={scale:.012,pivot:[46,240],shaft:[407,303],period:6,
 rollers:[[416,152],[426,250]],rollerRadii:[25,24],planes:[-.4,.4]};
// Both cams share one smooth convex egg profile: Brown draws the pair as
// the same egg shape set at different angles, and the traced outlines differ
// mainly by drawing error. The profile is the three-harmonic radial curve
// (about the shaft, pixels, lobe at angle 0) fitted jointly to both traced
// outlines, enlarged 12% toward the rear cam's longer drawn lobe: 113 px at
// the nose, 33 px at the heel, 47 px across the shaft. Each cam keeps the
// drawn direction of its lobe.
export const twinCamProfile={coefficients:[53.68372822857304,30.97079052484675,11.575745816389645,4.530990027994834].map(c=>c*1.12),samples:192,lobes:[1.51,3.49]};
export function twinCamRadius(angle){
 return twinCamProfile.coefficients.reduce((r,c,k)=>r+c*Math.cos(k*angle),0);
}
export function twinCamContours(){
 const {samples,lobes}=twinCamProfile;
 return lobes.map(lobe=>Array.from({length:samples},(_,i)=>{
  const u=2*Math.PI*i/samples,a=lobe+u,r=twinCamRadius(u)*twinCamSource.scale;
  return [r*Math.cos(a),r*Math.sin(a)];
 }));
}
export const twinCamLevers=twinCamSource.rollers.map(([x,y],i)=>{
 const dx=(x-twinCamSource.pivot[0])*twinCamSource.scale,dy=(twinCamSource.pivot[1]-y)*twinCamSource.scale;
 const length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 const rodX=[277,290][i],attachment=length*(rodX-twinCamSource.pivot[0])/(x-twinCamSource.pivot[0]);
 const headY=twinCamSource.pivot[1]-attachment*Math.sin(angle)/twinCamSource.scale;
 const rodLength=([414,430][i]-headY)*twinCamSource.scale,rodPinDistance=rodLength-.15;
 return {length,angle,radius:twinCamSource.rollerRadii[i]*twinCamSource.scale,z:twinCamSource.planes[i],
  attachment,rodLength,rodPinDistance,rodZ:.43,
  guideX:attachment*Math.cos(angle),guideY:attachment*Math.sin(angle)-rodPinDistance};
});
// Lever angles at which each roller rests on its cam in the engraving pose
// (shaft angle 0); the shared profile differs from the drawn outlines, so
// the drawn lever angles would leave a gap or an overlap.
export function twinCamRestAngles(){
 const contours=twinCamContours(),shaft=[(twinCamSource.shaft[0]-twinCamSource.pivot[0])*twinCamSource.scale,(twinCamSource.pivot[1]-twinCamSource.shaft[1])*twinCamSource.scale];
 return twinCamLevers.map((l,i)=>{
  const gap=a=>Math.min(...contours[i].map(([x,y])=>Math.hypot(shaft[0]+x-l.length*Math.cos(a),shaft[1]+y-l.length*Math.sin(a))))-l.radius;
  let low=l.angle-.2,high=l.angle+.2;
  for(let k=0;k<60;k++){const m=(low+high)/2;if(gap(m)<0)low=m;else high=m;}
  return high;
 });
}
