export const eggSource = {scale:.012, shaft:[107,258], crank:[57,332], wrist:[480,260], tracer:[206,309]};
const r=Math.hypot(50,74)*eggSource.scale, length=Math.hypot(423,72)*eggSource.scale;
export const eggGeometry = {radius:r,length,guideY:-2*eggSource.scale,
  fraction:(149*423+23*72)/(423*423+72*72),phase:Math.atan2(-74,-50),period:4};
export function eggAtAngle(angle,g=eggGeometry) {
  const crank=[g.radius*Math.cos(angle),g.radius*Math.sin(angle)];
  const dy=g.guideY-crank[1],reach=Math.sqrt(g.length*g.length-dy*dy);
  if(!Number.isFinite(reach)||reach<=0)throw new RangeError('Unreachable egg-curve slider');
  const wrist=[crank[0]+reach,g.guideY];
  return {angle,crank,wrist,rodAngle:Math.atan2(dy,reach),tracer:crank.map((v,i)=>v+g.fraction*(wrist[i]-v))};
}
export const eggAtTime=time=>eggAtAngle(eggGeometry.phase-2*Math.PI*time/eggGeometry.period);
