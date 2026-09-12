import {makePumpCatchHeelContact} from './pump-catch-heel-contact.mjs';

// Keep the established narrow contact calculation unchanged. During its
// synchronous queries, skip vertices outside the obstacle's expanded box.
// Outside queries, the exposed closest-point methods retain their full API.
export function makePumpCatchBoundsContact(model){
  const base=makePumpCatchHeelContact(model),stats={closestCalls:0,skipped:0};let margin=null;
  for(const name of ['cam','hook','shaft','stop']){
    const surface=base[name],closest=surface.closest,low=[0,1].map(k=>Math.min(...surface.points.map(p=>p[k]))),high=[0,1].map(k=>Math.max(...surface.points.map(p=>p[k])));
    surface.closest=p=>{
      if(margin!==null){
        stats.closestCalls++;
        const square=[0,1].reduce((s,k)=>s+Math.max(0,low[k]-p[k],p[k]-high[k])**2,0);
        // Expand conservatively near the margin; the original narrow query
        // still decides whether a retained feature actually qualifies.
        if(square>(Math.max(0,margin)+2e-12)**2){stats.skipped++;return{gap:Infinity};}
      }
      return closest(p);
    };
  }
  const withBounds=(distance,fn)=>{const previous=margin;margin=distance;try{return fn();}finally{margin=previous;}};
  return{...base,stats,query:(q,angle,options)=>withBounds(options?.margin??.01,()=>base.query(q,angle,options)),
    minimumRawGap:(q,angle)=>withBounds(.01,()=>base.minimumRawGap(q,angle)),
    qualification:base.qualification+' Conservative obstacle boxes reject only points farther than the query margin; retained finite features use the unchanged narrow calculation.'};
}
