import {add,sub,rotate} from '../../src/simulation/finite-plate-geometry.js';
import {finitePolygon,dot,cross,mul} from './pull-pawl-contact-study.mjs';

export function makeCrossedRackContact(candidate){
 const u=candidate.root.userData;
 for(const key of ['rack','left','right'])if(u.profiles[key].length!==1)throw Error('Contact requires a single connected profile: '+key);
 const profiles=Object.fromEntries(['rack','left','right'].map(key=>[key,finitePolygon(u.profiles[key][0][0])]));
 for(const profile of Object.values(profiles))profile.convex=profile.edges.map((edge,i)=>
  cross(profile.edges[(i+profile.edges.length-1)%profile.edges.length].d,edge.d)>=0);
 const features=(profile,point,nearest,padding)=>{
  const count=profile.points.length;
  for(const vertex of [nearest.index,(nearest.index+1)%count])if(!profile.convex[vertex]){
   const previous=profile.edges[(vertex+count-1)%count],next=profile.edges[vertex],
    radius=Math.min(padding,previous.length/4,next.length/4);
   if(Math.hypot(...sub(point,profile.points[vertex]))<=radius){
    // A convex tooth in a concave hook corner meets its two real facets.
    // Their exterior half-planes intersect locally. A normal chosen from
    // the opposing tooth's arbitrary endpoint face is not a valid substitute.
    return[previous,next].map(edge=>{
     const gap=dot(sub(point,edge.a),edge.normal);
     return{id:'V'+vertex+'E'+edge.index,gap,normal:edge.normal,point:sub(point,mul(edge.normal,gap))};
    });
   }
  }
  if(nearest.fraction>0&&nearest.fraction<1){
   // An interior face has its exact facet normal. Normalizing a nearly
   // zero point-to-projection vector loses direction digits at contact.
   const normal=nearest.edge.normal,gap=dot(sub(point,nearest.edge.a),normal);
   return[{...nearest,id:'E'+nearest.index,normal,gap,point:sub(point,mul(normal,gap))}];
  }
  return[{...nearest,id:'E'+nearest.index}];
 };
 // The hooks engage the outside teeth. The slot is deliberately excluded
 // from this primary-contact construction; its fulcrum clearance and every
 // other 3D part pair require separate checks on the complete meshes.
 const pair=(key,q,rackY,alpha,padding=.003)=>{
  const rack=profiles.rack,pawl=profiles[key],P=u.anchorAt(key,q),rows=[];let minimumGap=Infinity;
  const keep=(id,f,normal,R,H)=>{
   minimumGap=Math.min(minimumGap,f.gap);if(f.gap>padding)return;
   rows.push({id:key+':'+id,key,gap:f.gap,normal,rackPoint:R,pawlPoint:H,
    J:[-normal[1],cross(sub(H,P),normal)]});
  };
  for(let i=0;i<pawl.points.length;i++){
   const H=add(P,rotate(pawl.points[i],alpha)),local=[H[0],H[1]-rackY],nearest=rack.closest(local);
   minimumGap=Math.min(minimumGap,nearest.gap);if(!pawl.convex[i])continue;
   for(const f of features(rack,local,nearest,padding)){
    const R=[f.point[0],f.point[1]+rackY];keep('H'+i+'R'+f.id,f,f.normal,R,H);
   }
  }
  const center=add(P,rotate(pawl.center,alpha));
  for(let i=0;i<rack.points.length;i++){
   const R=[rack.points[i][0],rack.points[i][1]+rackY],lower=Math.hypot(...sub(R,center))-pawl.radius;
   if(lower>Math.max(padding,minimumGap))continue;
   const local=rotate(sub(R,P),-alpha),nearest=pawl.closest(local);
   minimumGap=Math.min(minimumGap,nearest.gap);if(!rack.convex[i])continue;
   for(const f of features(pawl,local,nearest,padding)){
    const H=add(P,rotate(f.point,alpha)),normal=mul(rotate(f.normal,alpha),-1);keep('R'+i+'H'+f.id,f,normal,R,H);
   }
  }
  return{rows,minimumGap};
 };
 return{profiles,pair};
}
export{dot,cross,mul};
