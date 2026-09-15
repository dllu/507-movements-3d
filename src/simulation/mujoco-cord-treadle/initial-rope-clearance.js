// A polygon inscribed in the rope's pitch circle cuts through the pulley.
// Lift nearby interior vertices radially, preserving the two secured endpoints.
// This prepares the initial geometry only; it is not a runtime rope constraint.
export function clearCircularGuide(points,center,radius,clearance=1e-6){
 if(!(radius>0)||!Number.isFinite(radius)||!(clearance>=0)||!Number.isFinite(clearance))throw new RangeError('Invalid guide dimensions');
 const distanceToSegment=(a,b)=>{const d=b.map((v,i)=>v-a[i]),den=d[0]**2+d[1]**2;if(!(den>0))throw new Error('Degenerate rope link');const t=Math.max(0,Math.min(1,((center[0]-a[0])*d[0]+(center[1]-a[1])*d[1])/den));return Math.hypot(a[0]+t*d[0]-center[0],a[1]+t*d[1]-center[1]);};
 const minimum=p=>Math.min(...p.slice(1).map((v,i)=>distanceToSegment(p[i],v)));
 const target=radius+clearance;
 if([points[0],points.at(-1)].some(p=>Math.hypot(p[0]-center[0],p[1]-center[1])<=target))throw new RangeError('Secured endpoint inside guide clearance');
 const directions=points.map((p,i)=>{if(i===0||i===points.length-1)return[0,0];const d=p.map((v,j)=>v-center[j]),r=Math.hypot(...d);if(!(r>0))throw new RangeError('Rope vertex at guide center');const weight=Math.exp(-(((r-radius)/(radius/3))**2));return d.map(v=>v/r*weight);});
 const moved=lift=>points.map((p,i)=>p.map((v,j)=>v+lift*directions[i][j]));
 if(minimum(points)>=target)return{points:points.map(p=>p.slice()),radialLift:0};
 let low=0,high=radius*.02;
 while(minimum(moved(high))<target){high*=2;if(high>radius)throw new Error('Cannot clear guide with a local radial lift');}
 for(let i=0;i<48;i++){const mid=(low+high)/2;if(minimum(moved(mid))<target)low=mid;else high=mid;}
 const result=moved(high);if(minimum(result)<target-1e-12)throw new Error('Initial guide clearance failed');
 return{points:result,radialLift:high};
}
