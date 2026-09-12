// Each front triangle lies inside its vertices' angular wedge (< pi). The
// ideal triangular-wave height is Lipschitz with slope 2 H / pitch. Therefore
// its difference from the triangle's barycentric native height is bounded by
// the largest vertex error plus slope times the full angular wedge width.
// This loose but analytic bound can skip native queries only while safely
// separated. Near engagement the exact triangle-intersection query is used.
export function weightedClutchJawBounds(model){
 const u=model.root.userData,pitch=2*Math.PI/u.geometry.jawCount,slope=2*u.geometry.jawHeight/pitch,fronts={};
 for(const name of ['leftLooseJaw','leftSlidingJaw','rightLooseJaw','rightSlidingJaw']){
  const g=u.parts[name].geometry,p=g.attributes.position,d=g.userData,base=d.profile[d.movingIndices[0]][0];
  let maximumWidth=0,maximumVertexError=0;
  for(let i=d.frontTriangleStart;i<d.frontTriangleStart+d.frontTriangleCount;i++){
   const angles=[0,1,2].map(j=>Math.atan2(p.getY(i*3+j),p.getX(i*3+j))),first=angles[0],
    near=angles.map(a=>first+Math.atan2(Math.sin(a-first),Math.cos(a-first)));
   maximumWidth=Math.max(maximumWidth,Math.max(...near)-Math.min(...near));
   for(let j=0;j<3;j++){
    const raw=(angles[j]-d.phase)/pitch,fraction=raw-Math.floor(raw),ideal=base+d.direction*d.jawHeight*Math.abs(2*fraction-1);
    maximumVertexError=Math.max(maximumVertexError,Math.abs(p.getZ(i*3+j)-ideal));
   }
  }
  if(!(maximumWidth<Math.PI))throw Error('Jaw triangle crosses an invalid angular wedge');
  fronts[name]={maximumWidth,maximumVertexError,error:maximumVertexError+slope*maximumWidth};
 }
 const error=side=>fronts[side+'LooseJaw'].error+fronts[side+'SlidingJaw'].error,
  ideal=(side,delta,x=0)=>{
   const wrapped=Math.atan2(Math.sin(delta*u.geometry.jawCount),Math.cos(delta*u.geometry.jawCount))/u.geometry.jawCount;
   return (side==='left'?u.lostMotion.parameters.stroke+x:-x)+u.geometry.jawAxialRelief-slope*Math.abs(wrapped);
  };
 return {fronts,error,ideal,lower:(side,delta,x=0)=>ideal(side,delta,x)-error(side)};
}
