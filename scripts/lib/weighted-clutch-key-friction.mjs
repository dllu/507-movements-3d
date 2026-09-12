import {solveClutchSystem} from './weighted-clutch-seating-contact.mjs';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

// Discrete, perfectly inelastic normal contact with one axial Coulomb contact.
// At rest prefer an admissible static solution; a sliding previous state keeps
// its kinetic branch while that branch still has the same slip direction.
// When it arrests, static friction is allowed. Report other feasible velocities
// rather than silently treating the non-associated Coulomb problem as a QP.
export function projectClutchKeyFriction(free,mass,constraints,{staticCoefficient,kineticCoefficient,previousSlip=0}={}){
 if(!(Number.isFinite(staticCoefficient)&&Number.isFinite(kineticCoefficient)&&
  staticCoefficient>=kineticCoefficient&&kineticCoefficient>=0))throw Error('Invalid key friction coefficients');
 const tolerance=1e-10,slipTolerance=1e-10,candidates=[],n=mass.length;
 if(mass.some(m=>!(m>0&&Number.isFinite(m)))||free.length!==n)throw Error('Invalid key-contact mass matrix');
 function candidate(indices,mode,bound=0){
  const active=indices.map(i=>constraints[i]),keyIndices=active.flatMap((c,i)=>c.friction==='axial-key'?[i]:[]);
  if(keyIndices.length>1)return;
  const keyIndex=keyIndices[0],key=active[keyIndex],tangent=key?.tangent,
   augmented=mode==='stick',rows=active.map(c=>c.gradient),columns=active.map(c=>c.gradient.slice()),
   rhs=active.map(c=>c.target-dot(c.gradient,free));
  if(augmented){rows.push(tangent);columns.push(tangent);rhs.push(-dot(tangent,free));}
  else if(key&&bound!==0)columns[keyIndex]=columns[keyIndex].map((v,k)=>v+bound*tangent[k]);
  if(rows.length>n)return;
  const matrix=rows.map(row=>columns.map(column=>row.reduce((s,v,k)=>s+v*column[k]/mass[k],0))),
   lambda=rhs.length?solveClutchSystem(matrix,rhs):[];
  if(!lambda||lambda.slice(0,active.length).some(v=>v< -1e-12))return;
  const beta=key?(augmented?lambda.at(-1):bound*lambda[keyIndex]):0,
   v=free.map((v,k)=>v+columns.reduce((s,col,j)=>s+lambda[j]*col[k]/mass[k],0)),
   slip=key?dot(tangent,v):v[2]??0;
  if(constraints.some(c=>dot(c.gradient,v)<c.target-tolerance))return;
  if(active.some((c,i)=>Math.abs(dot(c.gradient,v)-c.target)>tolerance))return;
  if(key){
   const normal=Math.max(0,lambda[keyIndex]);
   if(mode==='slide-positive'&&slip<=slipTolerance||mode==='slide-negative'&&slip>=-slipTolerance)return;
   if(!mode.startsWith('slide')&&(Math.abs(slip)>slipTolerance||Math.abs(beta)>staticCoefficient*normal+1e-12))return;
   if(beta*slip>1e-12)return;
  }
  const cost=v.reduce((s,value,k)=>s+mass[k]*(value-free[k])**2,0),
   reactions=active.map((c,i)=>({...c,impulse:lambda[i],tangentImpulse:i===keyIndex?beta:0})),
   work=reactions.reduce((s,c)=>s+c.impulse*c.target,0),frictionWork=beta*slip,
   energyChange=.5*mass.reduce((s,m,k)=>s+m*(v[k]**2-free[k]**2),0),loss=.5*cost-frictionWork;
  candidates.push({v,cost,active:reactions,mode:key?mode:'no-key',slip,tangentImpulse:beta,work,frictionWork,loss,
   impulseEnergyResidual:energyChange-work+loss});
 }
 function visit(indices,start){
  const keys=indices.filter(i=>constraints[i].friction==='axial-key');
  if(!keys.length)candidate(indices,'plain');
  else if(keys.length===1){
   candidate(indices,'stick');candidate(indices,'static-zero');
   candidate(indices,'static-negative-bound',-staticCoefficient);candidate(indices,'static-positive-bound',staticCoefficient);
   candidate(indices,'slide-positive',-kineticCoefficient);candidate(indices,'slide-negative',kineticCoefficient);
  }
  if(indices.length===n||keys.length>1)return;
  for(let i=start;i<constraints.length;i++)visit([...indices,i],i+1);
 }
 visit([],0);
 if(!candidates.length)throw Error('No admissible key-friction velocity');
 const continued=previousSlip>slipTolerance?'slide-positive':previousSlip< -slipTolerance?'slide-negative':null;
 function priority(c){
  if(c.mode==='no-key')return 0;
  if(continued&&c.mode===continued)return 0;
  if(!c.mode.startsWith('slide'))return 1;
  return 2;
 }
 candidates.sort((a,b)=>priority(a)-priority(b)||a.cost-b.cost||Math.abs(a.tangentImpulse)-Math.abs(b.tangentImpulse));
 const best=candidates[0],samePriority=candidates.filter(c=>priority(c)===priority(best));
 return{...best,feasibleCandidates:candidates.length,
  selectedPriorityVelocitySpread:Math.max(...samePriority.map(c=>Math.max(...c.v.map((v,i)=>Math.abs(v-best.v[i]))))),
  allModesVelocitySpread:Math.max(...candidates.map(c=>Math.max(...c.v.map((v,i)=>Math.abs(v-best.v[i]))))),
  feasibleModes:[...new Set(candidates.map(c=>c.mode))]};
}
