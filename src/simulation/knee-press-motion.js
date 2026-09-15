export const kneePressSource={scale:.018,top:[239,73],knee:[213,147],foot:[241,456],handle:[497,181]};
export function kneePressGeometry(){const s=kneePressSource,p=([x,y])=>[(x-s.top[0])*s.scale,4+(s.top[1]-y)*s.scale],top=p(s.top),knee=p(s.knee),foot=p(s.foot),handle=p(s.handle),upper=[knee[0]-top[0],knee[1]-top[1]],a=Math.hypot(...upper),b=Math.hypot(knee[0]-foot[0],knee[1]-foot[1]);const alignedX=a*(foot[0]-top[0])/(a+b),straightAngle=Math.atan2(-Math.sqrt(a*a-alignedX*alignedX),alignedX)-Math.atan2(upper[1],upper[0]);return{scale:s.scale,top,foot,upper,lowerLength:b,handle:[handle[0]-top[0],handle[1]-top[1]],straightAngle,closedAngle:straightAngle-.012,period:4};}
export function kneePressAtAngle(angle,g=kneePressGeometry()){
 const c=Math.cos(angle),s=Math.sin(angle),rotate=([x,y])=>[x*c-y*s,x*s+y*c],u=rotate(g.upper),h=rotate(g.handle),x=g.top[0]+u[0],offset=x-g.foot[0],drop=Math.sqrt(g.lowerLength**2-offset**2);
 if(!(drop>0))throw new RangeError('Knee link cannot reach its fixed foot');
 const knee=[x,g.foot[1]+drop],top=[g.top[0],knee[1]-u[1]],topSlope=offset*u[1]/drop-u[0];
 return{angle,top,knee,foot:g.foot,handle:[top[0]+h[0],top[1]+h[1]],lowerAngle:Math.atan2(knee[1]-g.foot[1],knee[0]-g.foot[0]),topSlope,handleSlope:topSlope+h[0]};
}
export function kneePressState(time,g=kneePressGeometry()){if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid playback time');return kneePressAtAngle(g.closedAngle*(1-Math.cos(2*Math.PI*time/g.period))/2,g);}
