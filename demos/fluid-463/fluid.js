// Compact CPU position-based fluid experiment. Equations and references in README.md.
// World units are meters. Every active particle represents spacing^3 cubic meters.
export const CHANNEL = { left: -3.5, right: 3.5, halfWidth: 1.08, floor: 0.04, ceiling: 3.85 };
export const GATE = { upperX: 0.03, upperY: 1.42, upperBottom: -0.70, upperTop: 1.68,
  lowerX: -0.03, lowerY: 0.46, lowerBottom: -0.46, lowerTop: 0.54,
  thickness: 0.06, notchBottom: 0.88, notchWidth: 0.76, width: 2.16 };
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function gatePose(opening) {
  const upper = -opening;
  const c = Math.cos(upper), s = Math.sin(upper);
  const contactX = GATE.upperX - s * GATE.upperBottom - c * GATE.thickness / 2;
  const contactY = GATE.upperY + c * GATE.upperBottom - s * GATE.thickness / 2;
  const dx = contactX - GATE.lowerX, dy = contactY - GATE.lowerY;
  const lower = Math.atan2(dy, dx) - Math.acos(clamp(GATE.thickness / 2 / Math.hypot(dx, dy), -1, 1));
  return { upper, lower };
}

export class Fluid {
  constructor(detail = 'balanced') {
    this.spacing = { light: 0.185, balanced: 0.149, fine: 0.124 }[detail];
    this.capacity = 16000;
    this.h = this.spacing * 1.85;
    this.radius = this.spacing * 0.17;
    this.volume = this.spacing ** 3;
    this.positions = new Float32Array(this.capacity * 3);
    this.previous = new Float32Array(this.capacity * 3);
    this.velocities = new Float32Array(this.capacity * 3);
    this.corrections = new Float32Array(this.capacity * 3);
    this.lambda = new Float32Array(this.capacity);
    this.density = new Float32Array(this.capacity);
    this.boundary = new Float32Array(this.capacity*4);
    this.neighbors = new Int32Array(this.capacity * 100);
    this.neighborCount = new Uint8Array(this.capacity);
    this.cellSize = this.h * 1.15;
    this.nx = Math.ceil(8 / this.cellSize) + 2;
    this.ny = Math.ceil(4.6 / this.cellSize) + 2;
    this.nz = Math.ceil(3 / this.cellSize) + 2;
    this.heads = new Int32Array(this.nx * this.ny * this.nz);
    this.next = new Int32Array(this.capacity);
    this.hist = new Int32Array(85);
    this.restDensity = 0;
    for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) for (let z = -2; z <= 2; z++) {
      const q = (x*x+y*y+z*z) * this.spacing ** 2 / this.h ** 2;
      if (q < 1) this.restDensity += (1-q) ** 3;
    }
    this.reset();
  }

  random() { this.seed = (1664525 * this.seed + 1013904223) >>> 0; return this.seed / 4294967296; }
  add(x, y, z, vx = 0, vy = 0, vz = 0) {
    if (this.count >= this.capacity) return false;
    const k = this.count++ * 3;
    this.positions[k] = x; this.positions[k+1] = y; this.positions[k+2] = z;
    this.velocities[k] = vx; this.velocities[k+1] = vy; this.velocities[k+2] = vz;
    return true;
  }
  reset() {
    this.count = 0; this.seed = 463; this.time = 0; this.angle = 0; this.angularVelocity = 0;
    this.inflow = 0.28; this.automatic = true; this.manualAngle = 0;
    this.injected = 0; this.drained = 0; this.emissionDebt = 0;
    this.upstreamHead = 2.76; this.downstreamHead = 0.25; this.floodUntil = 0;
    this.neighborOverflow = 0; this.pressureTorque = 0; this.bedCrossings = 0;
    const d = this.spacing;
    for (let x = CHANNEL.left+d*.5; x < -0.16; x += d) for (let y = CHANNEL.floor+d*.5; y < 2.84; y += d) {
      for (let z = -CHANNEL.halfWidth+d*.5; z < CHANNEL.halfWidth; z += d) this.add(x+(this.random()-.5)*d*.035, y, z);
    }
    for (let x = 0.3; x < 3.4; x += d) for (let y = 0.13; y < 0.32; y += d) {
      for (let z = -0.95; z < .99; z += d) this.add(x, y, z);
    }
    this.initialCount = this.count;
    this.buildColliders();
  }
  flood() { this.floodUntil = this.time + 9; this.automatic = true; }

  buildColliders() {
    const pose = gatePose(this.angle);
    this.pose = pose;
    const upper = (lo, hi, z, halfZ) => ({ x:GATE.upperX, y:GATE.upperY,
      c:Math.cos(pose.upper), s:Math.sin(pose.upper), lo, hi, z, halfZ });
    const earWidth = (GATE.width - GATE.notchWidth) / 2;
    this.colliders = [upper(GATE.upperBottom, GATE.notchBottom, 0, GATE.width/2),
      upper(GATE.notchBottom, GATE.upperTop, (GATE.notchWidth+earWidth)/2, earWidth/2),
      upper(GATE.notchBottom, GATE.upperTop, -(GATE.notchWidth+earWidth)/2, earWidth/2),
      {x:GATE.lowerX,y:GATE.lowerY,c:Math.cos(pose.lower),s:Math.sin(pose.lower),
        lo:GATE.lowerBottom,hi:GATE.lowerTop,z:0,halfZ:GATE.width/2}];
  }

  measureHeads() {
    const estimate = (upstream) => {
      this.hist.fill(0); let total = 0;
      for (let i = 0; i < this.count; i++) {
        const k = i*3, x = this.positions[k];
        if (upstream ? x < -0.85 : x > 1.0 && x < 3.0) {
          this.hist[clamp(Math.floor(this.positions[k+1]/.05),0,84)]++; total++;
        }
      }
      if(!upstream){
        // Reject sparse falling jets when estimating the downstream pool pressure.
        // A surface percentile alone mistakes the waterfall for a deep tailwater.
        const expected=2*CHANNEL.halfWidth*2*.25/this.volume;
        let pool=CHANNEL.floor;
        for(let j=1;j<75;j++){
          let band=0;for(let a=Math.max(0,j-2);a<=j+2;a++)band+=this.hist[a];
          if(band>=expected*.32)pool=Math.max(CHANNEL.floor,(j-.6)*.05);
          else if(j>4)break;
        }
        return pool;
      }
      let cumulative = 0;
      for (let i = 0; i < 85; i++) {
        cumulative += this.hist[i];
        if (cumulative >= total*.94) return total ? Math.min(4.1,(i+.5)*.05/.94) : CHANNEL.floor;
      }
      return CHANNEL.floor;
    };
    this.upstreamHead += (estimate(true)-this.upstreamHead)*.06;
    this.downstreamHead += (estimate(false)-this.downstreamHead)*.06;
  }

  gateTorque(angle) {
    const pose = gatePose(angle);
    const moment = (pivotY, lo, hi, theta, upper) => {
      let sum = 0;
      for (let i = 0; i < 40; i++) {
        const s = lo + (hi-lo)*(i+.5)/40;
        const y = pivotY + Math.cos(theta)*s;
        const pressureHead = Math.max(0,this.upstreamHead-y)-Math.max(0,this.downstreamHead-y);
        const width = GATE.width - (upper && s > GATE.notchBottom ? GATE.notchWidth : 0);
        sum += pressureHead * s * width * (hi-lo)/40;
      }
      return sum * 9810;
    };
    const derivative = (gatePose(angle+.0001).lower-gatePose(angle-.0001).lower)/.0002;
    return moment(GATE.upperY,GATE.upperBottom,GATE.upperTop,pose.upper,true)
      - derivative*moment(GATE.lowerY,GATE.lowerBottom,GATE.lowerTop,pose.lower,false);
  }

  step(dt = 1/60) {
    this.time += dt;
    this.measureHeads();
    this.pressureTorque = this.gateTorque(this.angle);
    if (this.automatic) {
      this.angularVelocity += (this.pressureTorque-1800*this.angularVelocity)*dt/750;
      this.angularVelocity = clamp(this.angularVelocity,-.5,.5);
      this.angle += this.angularVelocity*dt;
      if (this.angle < 0 || this.angle > .698) { this.angle = clamp(this.angle,0,.698); this.angularVelocity = 0; }
    } else {
      this.angle += clamp(this.manualAngle-this.angle,-dt*.5,dt*.5);
      this.angularVelocity = 0;
    }
    this.buildColliders();
    const inlet = this.time < this.floodUntil ? 1.8 : this.inflow;
    this.emissionDebt += inlet * dt / this.volume;
    // Inlet is a finite band at the head of the channel; account for every new particle.
    while (this.emissionDebt >= 1 && this.count < this.capacity) {
      const y = Math.min(3.65,Math.max(2.8,this.upstreamHead+.15));
      this.add(-3.32 + this.random()*.20, y+this.random()*.10,
        (this.random()-.5)*1.78, .48, -.2, 0);
      this.emissionDebt--; this.injected++;
    }
    if (this.count === this.capacity) this.emissionDebt = Math.min(this.emissionDebt,1);
    const p = this.positions, v = this.velocities, old = this.previous;
    for (let i = 0; i < this.count*3; i+=3) {
      old[i]=p[i]; old[i+1]=p[i+1]; old[i+2]=p[i+2];
      v[i+1] -= 9.81*dt;
      p[i] += v[i]*dt; p[i+1] += v[i+1]*dt; p[i+2] += v[i+2]*dt;
    }
    this.collide();
    this.findNeighbors();
    for (let iteration = 0; iteration < 3; iteration++) this.solveDensity();
    for (let i = 0; i < this.count*3; i++) v[i] = clamp((p[i]-old[i])/dt,-10,10)*.9995;
    for(let i=0;i<this.count;i++)if(old[i*3]<=.5&&p[i*3]>.5&&p[i*3+1]<.35)this.bedCrossings++;
    // XSPH-style velocity smoothing; use a separate array to avoid traversal bias.
    const out = this.corrections;
    for (let i = 0; i < this.count; i++) {
      const k=i*3; let vx=0,vy=0,vz=0,weight=0;
      for (let a=0;a<this.neighborCount[i];a++) {
        const j=this.neighbors[i*100+a], l=j*3;
        const dx=p[k]-p[l],dy=p[k+1]-p[l+1],dz=p[k+2]-p[l+2];
        const q=1-(dx*dx+dy*dy+dz*dz)/(this.h*this.h);
        if (q<=0) continue;
        const w=q*q*q; vx+=(v[l]-v[k])*w;vy+=(v[l+1]-v[k+1])*w;vz+=(v[l+2]-v[k+2])*w;weight+=w;
      }
      const factor=.055/Math.max(1,weight);
      out[k]=v[k]+vx*factor;out[k+1]=v[k+1]+vy*factor;out[k+2]=v[k+2]+vz*factor;
    }
    v.set(out.subarray(0,this.count*3));
    // Open downstream boundary. No recycling or hidden creation inside the fluid.
    for (let i=this.count-1;i>=0;i--) if (p[i*3] > CHANNEL.right+.15 || p[i*3+1]<-1) {
      const last=--this.count;
      for(let a=0;a<3;a++){p[i*3+a]=p[last*3+a];v[i*3+a]=v[last*3+a];}
      this.drained++;
    }
  }

  findNeighbors() {
    const p=this.positions, size=this.cellSize, nx=this.nx, ny=this.ny;
    this.heads.fill(-1);
    for(let i=0;i<this.count;i++) {
      const k=i*3;
      const x=clamp(Math.floor((p[k]+4)/size),1,nx-2);
      const y=clamp(Math.floor((p[k+1]+.3)/size),1,ny-2);
      const z=clamp(Math.floor((p[k+2]+1.5)/size),1,this.nz-2);
      const cell=(z*ny+y)*nx+x; this.next[i]=this.heads[cell];this.heads[cell]=i;
    }
    const search2=size*size;
    for(let i=0;i<this.count;i++) {
      const k=i*3,x=clamp(Math.floor((p[k]+4)/size),1,nx-2),y=clamp(Math.floor((p[k+1]+.3)/size),1,ny-2),z=clamp(Math.floor((p[k+2]+1.5)/size),1,this.nz-2);
      let count=0;
      for(let zz=z-1;zz<=z+1;zz++)for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++) {
        let j=this.heads[(zz*ny+yy)*nx+xx];
        while(j!==-1) {
          if(i!==j) {
            const l=j*3,dx=p[k]-p[l],dy=p[k+1]-p[l+1],dz=p[k+2]-p[l+2];
            if(dx*dx+dy*dy+dz*dz<search2){if(count<100)this.neighbors[i*100+count++]=j;else this.neighborOverflow++;}
          }
          j=this.next[j];
        }
      }
      this.neighborCount[i]=count;
    }
  }

  solveDensity() {
    const p=this.positions,h2=this.h*this.h,rest=this.restDensity;
    for(let i=0;i<this.count;i++) {
      const k=i*3;let density=1,gx=0,gy=0,gz=0,sum=0;
      for(let a=0;a<this.neighborCount[i];a++) {
        const l=this.neighbors[i*100+a]*3,dx=p[k]-p[l],dy=p[k+1]-p[l+1],dz=p[k+2]-p[l+2];
        const r2=dx*dx+dy*dy+dz*dz,q=1-r2/h2;if(q<=0)continue;
        density+=q*q*q;const grad=-6*q*q/h2/rest;
        gx+=grad*dx;gy+=grad*dy;gz+=grad*dz;sum+=grad*grad*r2;
      }
      this.boundaryDensity(i);
      const b=i*4;gx+=this.boundary[b+1];gy+=this.boundary[b+2];gz+=this.boundary[b+3];
      this.density[i]=density/rest+this.boundary[b];
      this.lambda[i]=-Math.max(0,this.density[i]-1)/(sum+gx*gx+gy*gy+gz*gz+.01);
    }
    const dp=this.corrections;
    for(let i=0;i<this.count;i++) {
      const k=i*3,b=i*4;let sx=this.lambda[i]*this.boundary[b+1],sy=this.lambda[i]*this.boundary[b+2],sz=this.lambda[i]*this.boundary[b+3];
      for(let a=0;a<this.neighborCount[i];a++) {
        const j=this.neighbors[i*100+a],l=j*3,dx=p[k]-p[l],dy=p[k+1]-p[l+1],dz=p[k+2]-p[l+2];
        const r2=dx*dx+dy*dy+dz*dz,q=1-r2/h2;if(q<=0)continue;
        const artificial=-.000025*(q*q*q/.753571)**4;
        const factor=(this.lambda[i]+this.lambda[j]+artificial)*(-6*q*q/h2)/rest;
        sx+=factor*dx;sy+=factor*dy;sz+=factor*dz;
      }
      const scale=Math.min(1,this.h*.16/Math.max(1e-9,Math.hypot(sx,sy,sz)));
      dp[k]=sx*scale;dp[k+1]=sy*scale;dp[k+2]=sz*scale;
    }
    for(let i=0;i<this.count*3;i++)p[i]+=dp[i];
    this.collide();
  }

  boundaryDensity(i) {
    // Integrate the missing Poly6 kernel over the solid half-space. This prevents
    // water at the floor and walls from collapsing to compensate for missing neighbors.
    const k=i*3,b=i*4,p=this.positions;
    let density=0,gx=0,gy=0,gz=0;
    const add=(distance,nx,ny,nz)=>{
      if(distance>=this.h)return;
      const a=Math.max(0,distance/this.h),a2=a*a;
      const fraction=.5-(315/256)*a*(1-a2*(4/3-a2*(6/5-a2*(4/7-a2/9))));
      const gradient=-(315/256)*(1-a2)**4/this.h;
      density+=fraction;gx+=gradient*nx;gy+=gradient*ny;gz+=gradient*nz;
    };
    add(p[k+1]-CHANNEL.floor,0,1,0);
    add(p[k]-CHANNEL.left,1,0,0);
    add(p[k+2]+CHANNEL.halfWidth,0,0,1);
    add(CHANNEL.halfWidth-p[k+2],0,0,-1);
    // The nearest gate face contributes once; adjacent pieces form a single boundary.
    let best=this.h,bx=0,by=0;
    for(const collider of this.colliders){
      const dx=p[k]-collider.x,dy=p[k+1]-collider.y;
      const x=collider.c*dx+collider.s*dy,y=-collider.s*dx+collider.c*dy;
      const distance=Math.abs(x)-GATE.thickness/2;
      if(distance<best&&y>=collider.lo&&y<=collider.hi&&Math.abs(p[k+2]-collider.z)<=collider.halfZ){
        best=Math.max(0,distance);const sign=x>=0?1:-1;bx=collider.c*sign;by=collider.s*sign;
      }
    }
    add(best,bx,by,0);
    this.boundary[b]=density;this.boundary[b+1]=gx;this.boundary[b+2]=gy;this.boundary[b+3]=gz;
  }

  collide() {
    const p=this.positions,r=this.radius,half=GATE.thickness/2+r;
    for(let i=0;i<this.count;i++) {
      const k=i*3;
      p[k]=Math.max(CHANNEL.left+r,p[k]);
      p[k+1]=clamp(p[k+1],CHANNEL.floor+r,CHANNEL.ceiling-r);
      p[k+2]=clamp(p[k+2],-CHANNEL.halfWidth+r,CHANNEL.halfWidth-r);
      for(const b of this.colliders) {
        const dx=p[k]-b.x,dy=p[k+1]-b.y;
        const x=b.c*dx+b.s*dy,y=-b.s*dx+b.c*dy,z=p[k+2]-b.z;
        if(Math.abs(x)>=half||y<=b.lo-r||y>=b.hi+r||Math.abs(z)>=b.halfZ+r)continue;
        const px=half-Math.abs(x),py=Math.min(y-b.lo+r,b.hi+r-y),pz=b.halfZ+r-Math.abs(z);
        if(px<=py&&px<=pz){const d=(x>=0?px:-px);p[k]+=b.c*d;p[k+1]+=b.s*d;}
        else if(py<=pz){const d=(y<(b.lo+b.hi)/2?-py:py);p[k]-=b.s*d;p[k+1]+=b.c*d;}
        else p[k+2]+=(z>=0?pz:-pz);
      }
    }
  }

  stats() {
    let maxSpeed=0,finite=true,penetrations=0;
    for(let i=0;i<this.count;i++) {
      const k=i*3,x=this.positions[k],y=this.positions[k+1],z=this.positions[k+2];
      finite &&= Number.isFinite(x+y+z);
      maxSpeed=Math.max(maxSpeed,Math.hypot(this.velocities[k],this.velocities[k+1],this.velocities[k+2]));
      for(const b of this.colliders){const lx=b.c*(x-b.x)+b.s*(y-b.y),ly=-b.s*(x-b.x)+b.c*(y-b.y);
        if(Math.abs(lx)<GATE.thickness/2-1e-5&&ly>b.lo+1e-5&&ly<b.hi-1e-5&&Math.abs(z-b.z)<b.halfZ-1e-5)penetrations++;}
    }
    return {time:this.time,count:this.count,initial:this.initialCount,injected:this.injected,drained:this.drained,
      particleBalance:this.count-this.initialCount-this.injected+this.drained,finite,maxSpeed,penetrations,
      head:this.upstreamHead,tail:this.downstreamHead,angle:this.angle*180/Math.PI,torque:this.pressureTorque,
      neighborOverflow:this.neighborOverflow,bedCrossings:this.bedCrossings};
  }
}
