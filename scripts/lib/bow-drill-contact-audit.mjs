/** Read native connection errors and contact-surface velocities, without driving anything. */
export function makeBowDrillContactAudit(p) {
  const {mujoco:mj,model:m,data:d}=p;
  const velocityBuffer=new mj.DoubleBuffer(6),forceBuffer=new mj.DoubleBuffer(6);
  const pins=[[p.id('mjOBJ_SITE','lowerEnd'),p.ends[0][0]],
    [p.id('mjOBJ_SITE','upperEnd'),p.ends.at(-1)[1]]];
  const joins=p.ends.slice(1).map(([a],i)=>[p.ends[i][1],a]);
  const drum=p.id('mjOBJ_GEOM','drum');
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const gap=([a,b])=>Math.hypot(...[0,1,2].map(k=>d.site_xpos[3*a+k]-d.site_xpos[3*b+k]));
  let disposed=false;
  return {
    sample() {
      if(disposed)throw Error('Disposed 124 contact audit');
      const velocities=new Map();
      const velocity=body=>{
        if(!velocities.has(body)) {
          mj.mj_objectVelocity(m,d,mj.mjtObj.mjOBJ_BODY.value,body,velocityBuffer,0);
          velocities.set(body,Array.from(velocityBuffer.GetView()));
        }
        return velocities.get(body);
      };
      const atPoint=(body,point)=>{
        const v=velocity(body),offset=point.map((x,k)=>x-d.xpos[3*body+k]);
        return cross(v.slice(0,3),offset).map((x,k)=>x+v[3+k]);
      };
      let penetration=0,normalForce=0,slipSquared=0,centerSlipSquared=0,spindleTorque=0,drumContacts=0;
      const contacts=d.contact;
      try {for(let i=0;i<contacts.size();i++) {
        const c=contacts.get(i);
        try {
          penetration=Math.max(penetration,-c.dist);
          const geoms=Array.from(c.geom),bodies=geoms.map(g=>m.geom_bodyid[g]);
          mj.mj_contactForce(m,d,i,forceBuffer);
          const force=Array.from(forceBuffer.GetView()),frame=Array.from(c.frame),pos=Array.from(c.pos);
          if(bodies.includes(p.bodies.spindle)) {
            const sign=bodies[1]===p.bodies.spindle?1:-1;
            const world=[0,1,2].map(k=>sign*(frame[k]*force[0]+frame[3+k]*force[1]+frame[6+k]*force[2]));
            spindleTorque+=cross(pos,world)[2];
          }
          if(!geoms.includes(drum)||force[0]<=0)continue;
          drumContacts++;
          const cord=bodies.find(b=>b!==p.bodies.spindle),wheel=atPoint(p.bodies.spindle,pos);
          const surface=atPoint(cord,pos),center=velocity(cord).slice(3);
          const slip=surface.map((v,k)=>v-wheel[k]),centerSlip=center.map((v,k)=>v-wheel[k]);
          const tangent=[-pos[1],pos[0],0].map(x=>x/Math.hypot(pos[0],pos[1]));
          normalForce+=force[0];
          slipSquared+=force[0]*dot(slip,tangent)**2;
          centerSlipSquared+=force[0]*dot(centerSlip,tangent)**2;
        }finally{c.delete();}
      }}finally{contacts.delete();}
      return {penetration,closure:Math.max(...joins.map(gap)),pinError:Math.max(...pins.map(gap)),
        drumContacts,normalForce,slipSquared,centerSlipSquared,spindleTorque,
        torqueResidual:spindleTorque-d.qfrc_constraint[p.joints.spin.v]};
    },
    dispose(){if(disposed)return;disposed=true;velocityBuffer.delete();forceBuffer.delete();},
  };
}
