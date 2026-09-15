// Approximate pixel traces from the 525px engraving. The lower half of the
// rear cam is hidden by the front cam and is reconstructed as a convex arc.
export const twinCamSource={scale:.012,pivot:[46,240],shaft:[407,303],period:6,
 rollers:[[416,152],[426,250]],rollerRadii:[25,24],planes:[-.4,.4]};
const controls=[
 [[416,175],[430,182],[442,205],[451,231],[457,257],[455,281],[447,305],[432,325],[410,331],[390,316],[379,294],[378,270],[383,242],[392,214],[402,191]],
 [[418,273],[436,280],[451,295],[458,314],[451,336],[437,353],[416,365],[389,372],[359,369],[334,361],[317,348],[309,332],[315,316],[329,300],[350,288],[377,279]],
];
const convexHull=points=>{
 const p=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const half=items=>{const h=[];for(const q of items){while(h.length>1&&cross(h.at(-2),h.at(-1),q)<=0)h.pop();h.push(q);}return h;};
 return [...half(p).slice(0,-1),...half([...p].reverse()).slice(0,-1)];
};
export function twinCamContours(){
 return controls.map(points=>{
  let p=convexHull(points);
  // Chaikin refinement stays inside the convex control polygon. Its slight
  // corner rounding is an explicit approximation of the printed outline.
  for(let k=0;k<2;k++)p=p.flatMap((a,i)=>{const b=p[(i+1)%p.length];return [[.75*a[0]+.25*b[0],.75*a[1]+.25*b[1]],[.25*a[0]+.75*b[0],.25*a[1]+.75*b[1]]];});
  return p.map(([x,y])=>[(x-twinCamSource.shaft[0])*twinCamSource.scale,(twinCamSource.shaft[1]-y)*twinCamSource.scale]);
 });
}
export const twinCamLevers=twinCamSource.rollers.map(([x,y],i)=>{
 const dx=(x-twinCamSource.pivot[0])*twinCamSource.scale,dy=(twinCamSource.pivot[1]-y)*twinCamSource.scale;
 const length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 const rodX=[277,290][i],attachment=length*(rodX-twinCamSource.pivot[0])/(x-twinCamSource.pivot[0]);
 const headY=twinCamSource.pivot[1]-attachment*Math.sin(angle)/twinCamSource.scale;
 return {length,angle,radius:twinCamSource.rollerRadii[i]*twinCamSource.scale,z:twinCamSource.planes[i],
  attachment,rodLength:([414,430][i]-headY)*twinCamSource.scale,rodZ:.43};
});
