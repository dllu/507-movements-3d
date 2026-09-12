// The engraving omits the bucket and rope termination. This diagnostic assumes
// a pin at the left rim in the source pose, a vertical bucket guide at x=-R,
// and a massless rope of fixed length. Winding angle retains complete turns.
export function pumpCatchRope(q,{radius:R,ropeLength:L=4.75}){
  const alpha=-Math.PI+q[0],anchor=[R*Math.cos(alpha),R*Math.sin(alpha)],pump=[-R,q[2]-L],distance=Math.hypot(...pump);
  let beta=Math.atan2(pump[1],pump[0]);if(beta>0)beta-=2*Math.PI;
  const gamma=Math.acos(Math.min(1,R/distance)),low=beta-gamma,high=beta+gamma;
  let tangent=anchor,arcAngle=0,winding=0;
  if(alpha<low){arcAngle=low-alpha;winding=1;tangent=[R*Math.cos(low),R*Math.sin(low)];}
  else if(alpha>high){arcAngle=alpha-high;winding=-1;tangent=[R*Math.cos(high),R*Math.sin(high)];}
  const delta=pump.map((v,k)=>v-tangent[k]),straightLength=Math.hypot(...delta);
  if(straightLength<1e-12)throw Error('Bucket coincides with the rope attachment');
  const n=delta.map(v=>v/straightLength),pathLength=R*arcAngle+straightLength;
  const gradient=[winding?winding*R:anchor[0]*n[1]-anchor[1]*n[0],0,-n[1]];
  return{kind:'rope',gap:L-pathLength,gradient,inputGradient:0,
    path:{anchor,pump,tangent,alpha,arcAngle,winding,straightLength,pathLength,length:L}};
}
