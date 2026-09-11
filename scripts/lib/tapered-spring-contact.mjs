const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];

// A segment is the union of disks with linearly varying radius. For a fixed
// point, minimize |point - (root + t*edge)| - (radius + t*radiusChange).
// The interior stationary point follows directly from the derivative of
// sqrt(height^2 + length^2*(t-projection)^2) - t*radiusChange.
function projection(point,root,edge,radiusChange){
  const delta=sub(point,root),lengthSquared=dot(edge,edge),length=Math.sqrt(lengthSquared);
  if(Math.abs(radiusChange)>=length)throw new Error('Taper exceeds segment length');
  const centerProjection=dot(delta,edge)/lengthSquared,height=Math.abs(cross(delta,edge))/length;
  return Math.max(0,Math.min(1,centerProjection+radiusChange*height/(length*Math.sqrt(lengthSquared-radiusChange**2))));
}

export function taperedSpringContacts(a,b,c,d,radii){
  const u=sub(b,a),v=sub(d,c),ac=sub(c,a),ad=sub(d,a),ca=sub(a,c),cb=sub(b,c);
  if(cross(u,ac)*cross(u,ad)<-1e-16&&cross(v,ca)*cross(v,cb)<-1e-16)
    throw new Error('Spring centerlines crossed');
  const [ra,rb,rc,rd]=radii;
  // For nonintersecting straight centerlines the convex distance-minus-radius
  // function attains its minimum on a boundary of [0,1]^2. An interior minimum
  // has a flat direction that reaches that boundary. Keep all four witnesses
  // so parallel contacting sides can carry more than one reaction.
  return [[0,projection(a,c,v,rd-rc)],[1,projection(b,c,v,rd-rc)],
    [projection(c,a,u,rb-ra),0],[projection(d,a,u,rb-ra),1]].map(([s,t],endpoint)=>{
    const first=[a[0]+s*u[0],a[1]+s*u[1]],second=[c[0]+t*v[0],c[1]+t*v[1]];
    return{s,t,endpoint,first,second,delta:sub(first,second),radius:ra+s*(rb-ra)+rc+t*(rd-rc)};
  });
}
