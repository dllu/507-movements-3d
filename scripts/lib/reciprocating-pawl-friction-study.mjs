const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const angularVelocity=(p,w)=>[-p[1]*w,p[0]*w];

function solve3(matrix,rhs){
  const a=matrix.map((row,i)=>[...row,rhs[i]]);
  for(let i=0;i<3;i++){
    let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    if(Math.abs(a[pivot][i])<1e-10)return null;
    [a[i],a[pivot]]=[a[pivot],a[i]];
    const divisor=a[i][i];for(let k=i;k<=3;k++)a[i][k]/=divisor;
    for(let j=0;j<3;j++)if(j!==i){const factor=a[j][i];for(let k=i;k<=3;k++)a[j][k]-=factor*a[i][k];}
  }
  return a.map(row=>row[3]);
}

export function pawlFrictionColumns(state,mu){
  const columns=[],sliding=[];
  for(const kind of ['B','H']){
    const pawl=state[kind],seated=pawl.contacts.length>1,
      pivotVelocity=kind==='B'?angularVelocity(pawl.pivot,state.barVelocity):[0,0];
    for(const contact of pawl.contacts){
      const {normal,point}=contact,arm=sub(point,pawl.pivot),tangent=[-normal[1],normal[0]];
      let directions=[-1,1];
      if(!seated){
        const rotation=(state.wheelVelocity*cross(point,normal)-dot(pivotVelocity,normal))/cross(arm,normal),
          rotationalVelocity=angularVelocity(arm,rotation),wheelVelocity=angularVelocity(point,state.wheelVelocity),
          relativeVelocity=pivotVelocity.map((v,i)=>v+rotationalVelocity[i]-wheelVelocity[i]),
          slip=dot(relativeVelocity,tangent);
        directions=[-Math.sign(slip)];
        sliding.push({kind,feature:contact.feature,rotation,slip,normalVelocity:dot(relativeVelocity,normal)});
      }
      for(const sign of directions){
        const force=normal.map((v,i)=>v+sign*mu*tangent[i]),pawlMoment=cross(arm,force),wheelMoment=-cross(point,force);
        columns.push({kind,feature:contact.feature,normal,tangent,sign,force,pawlMoment,wheelMoment,
          column:kind==='B'?[pawlMoment,0,wheelMoment]:[0,pawlMoment,wheelMoment]});
      }
    }
  }
  return{columns,sliding};
}

export function pawlFrictionIntervals(state,mu,massFactor=1){
  const {columns,sliding}=pawlFrictionColumns(state,mu),intervals=[];
  for(let i=0;i<columns.length;i++)for(let j=i+1;j<columns.length;j++)for(let k=j+1;k<columns.length;k++){
    const chosen=[i,j,k],matrix=[0,1,2].map(row=>chosen.map(c=>columns[c].column[row])),
      base=solve3(matrix,[-state.B.gravityMoment,-state.H.gravityMoment*massFactor,0]),slope=solve3(matrix,[0,0,-1]);
    if(!base||!slope)continue;
    let low=-Infinity,high=Infinity,okay=true;
    for(let n=0;n<3;n++){
      if(Math.abs(slope[n])<1e-12){if(base[n]<-1e-8)okay=false;}
      else if(slope[n]>0)low=Math.max(low,-base[n]/slope[n]);else high=Math.min(high,-base[n]/slope[n]);
    }
    if(okay&&high>=low)intervals.push({low,high,chosen,base,slope});
  }
  // Projection of this convex force cone onto load is a single interval.
  return{low:Math.min(...intervals.map(x=>x.low)),high:Math.max(...intervals.map(x=>x.high)),intervals,columns,sliding};
}
