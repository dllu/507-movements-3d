import {pumpCatchHasSlidingCam} from './pump-catch-contact-mode.mjs';

// A zero reaction at a tiny step does not imply that two surfaces separated.
// Keep nearby cam faces in the integration mode without inventing a force or
// modifying the impact solver's active reactions. The distance is the same
// finite-gap tolerance already used by that solver.
export function pumpCatchHybridMode(contact,row,angularSpeed){
  const nearCam=contact.query(row.q,angularSpeed*row.time).filter(c=>c.kind==='cam'&&c.gap<=2e-8),
    hasCam=row.active.some(c=>c.kind==='cam'),cam=hasCam||nearCam.length>0,
    kinds=new Set(row.active.filter(c=>c.kind!=='cam').map(c=>c.kind));
  if(cam)kinds.add('cam');
  return{signature:[...kinds].sort().join('+'),cam,
    sliding:cam&&(!hasCam||pumpCatchHasSlidingCam(row.active)),nearCam};
}
