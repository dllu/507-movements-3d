function leastSquares(rows,values) {
  const n=rows[0].length,a=Array.from({length:n},(_,i)=>[...Array.from({length:n},(_,j)=>rows.reduce((s,r)=>s+r[i]*r[j],0)),rows.reduce((s,r,k)=>s+r[i]*values[k],0)]);
  for(let i=0;i<n;i++) {
    let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    [a[i],a[pivot]]=[a[pivot],a[i]];const d=a[i][i];
    for(let j=i;j<=n;j++)a[i][j]/=d;
    for(let j=0;j<n;j++)if(i!==j){const f=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=f*a[i][k];}
  }
  return a.map(r=>r[n]);
}

// Even radial harmonics regularize the two hand-drawn branches. Every basis
// function vanishes at both measured reversal radii; derivatives vanish too.
export function fitGroovedHeart(points,minimum,maximum,modes=7) {
  const middle=(minimum+maximum)/2,half=(maximum-minimum)/2;
  const basis=(a,n)=>Math.cos(n*a)-(n%2?Math.cos(a):1);
  const rows=points.map(p=>Array.from({length:modes-1},(_,i)=>basis(p.angle,i+2)));
  const coefficients=leastSquares(rows,points.map(p=>p.radius-middle+half*Math.cos(p.angle)));
  const law=a=>{
    let r=middle-half*Math.cos(a),derivative=half*Math.sin(a),secondDerivative=half*Math.cos(a);
    coefficients.forEach((c,i)=>{const n=i+2;r+=c*basis(a,n);derivative+=c*(-n*Math.sin(n*a)+(n%2?Math.sin(a):0));secondDerivative+=c*(-n*n*Math.cos(n*a)+(n%2?Math.cos(a):0));});
    return {r,derivative,secondDerivative};
  };
  const residuals=points.map(p=>law(p.angle).r-p.radius);
  const widths=points.map(p=>{const {r,derivative:d}=law(p.angle);return p.width/Math.hypot(1,d/r);}).sort((a,b)=>a-b);
  return {coefficients,normalWidth:widths[Math.floor(widths.length/2)],residuals,rms:Math.sqrt(residuals.reduce((s,r)=>s+r*r,0)/residuals.length)};
}
