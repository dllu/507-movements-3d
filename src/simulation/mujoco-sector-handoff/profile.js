// Linear gear-driven travel joins a cosine-velocity reversal while the teeth
// are absent. This defines the driven rack and the reconstructed transfer cam;
// native contact must determine every output angle during simulation.
export function sectorHandoffTravel(theta,radius,halfSpan){
 const a=halfSpan,b=Math.PI/2-a,phase=((theta%(2*Math.PI))+2*Math.PI)%(2*Math.PI),sign=phase<Math.PI?-1:1,t=phase%Math.PI;
 if(t<a)return{position:sign*radius*t,derivative:sign*radius};
 if(t>Math.PI-a)return{position:sign*radius*(Math.PI-t),derivative:-sign*radius};
 const u=Math.PI*(t-a)/(2*b);return{position:sign*radius*(a+2*b/Math.PI*Math.sin(u)),derivative:sign*radius*Math.cos(u)};
}
