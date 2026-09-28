// Offline pin-envelope rack for Brown's partial (four of ten) lantern.
// Run with Node 18+ and the project's npm dependencies. The official
// triangular frame law is retained, including its impulsive reversal.
//
// Pass 96: every tooth space is ONE symmetric template, identical on both
// racks: the envelope of the lantern pin (plus a small clearance) swept
// through the cusp of its trochoid, which is a circular root arc concentric
// with the pin at the cusp and two near-straight conjugate flanks. The teeth
// are flat-topped at one height and end on the rack body; the entry teeth
// continue the working flank straight down to their long tips. The lower rack
// is the upper rack turned half a turn about the frame centre (the pin paths
// share that symmetry), so the two entry teeth are identical too.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createAuthoredGearMovement as create} from '../src/simulation/authored-gears.js';
const d=create({id:199}).root.userData,g=d.geometry;
const poses=4096,clearance=.00035,rows=256,overlap=.03;
const r=g.lanternPinRadius,R=r+clearance,pitch=g.circularPitch,edge=g.innerRackRadius;
const all=[];
for(let i=0;i<=poses;i++){
  const s=d.stateAtInputTravel(i*2*Math.PI/poses);
  for(const p of s.lanternPinCenters)all.push([p.x-s.frameTranslation.x,p.y]);
}
const top=g.topRackProfilesInMotionOrder,entryTip=Math.abs(top[0][1].y);
const cusps=[1,2,3,4].map(k=>+(k*pitch).toFixed(12));
const upper=all.map(([x,y])=>[x,Math.abs(y)]);// both racks' pins, folded onto the upper rack
const cuspY=Math.max(...upper.filter(([x])=>cusps.some(c=>Math.abs(x-c)<.01)).map(p=>p[1]));
const apex=cuspY+R;
// Required half width of a space at height y: every pin disc whose centre is
// nearer this cusp than any other, over both racks and all four spaces.
function required(y){
  let half=0;
  for(const [x,cy]of upper){const dy=y-cy;if(Math.abs(dy)>=R)continue;
    const c=cusps.reduce((a,b)=>Math.abs(x-a)<Math.abs(x-b)?a:b);if(Math.abs(x-c)>pitch/2)continue;
    const w=Math.sqrt(R*R-dy*dy);half=Math.max(half,Math.abs(x-w-c),Math.abs(x+w-c));}
  return half;
}
// Template half-width, monotone (non-increasing with height) so the flank is
// one clean curve from the tip corner into the root arc.
const templateRows=tip=>{
  const out=[];for(let i=0;i<=rows;i++){const t=i/rows,y=tip+(apex-tip)*(1-Math.cos(Math.PI*t/2));out.push([y,i===rows?0:required(y)]);}
  for(let i=out.length-2;i>=0;i--)out[i][1]=Math.max(out[i][1],out[i+1][1]);
  return out;
};
const pointSegment=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,u=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;return Math.hypot(p[0]-a[0]-u*dx,p[1]-a[1]-u*dy);};
const inside=(p,o)=>{let c=false;for(let i=0,j=o.length-1;i<o.length;j=i++){const a=o[i],b=o[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
const gapTo=(p,o)=>{let m=Infinity;for(let i=0;i<o.length;i++)m=Math.min(m,pointSegment(p,o[i],o[(i+1)%o.length]));return inside(p,o)?-m:m-r;};
function build(tip){
  const T=templateRows(tip),half0=T[0][1];
  // Mean flank slope (dx per unit drop) over the flank's straight part,
  // used for the free outer flanks and the entry tooth's continuation.
  const mid=T.find(([y])=>y>=tip+(cuspY-tip)*.5)??T[0];
  const slope=(half0-mid[1])/(mid[0]-tip);
  const rise=edge+overlap;
  const flank=(c,sign)=>T.map(([y,h])=>[c+sign*h,y]);// sign +1: right wall of space c (a tooth's left flank)
  const teeth=[];
  // Upper rack, in motion order: entry tooth (right) first, then leftwards.
  // Entry tooth: inner working flank = template of cusp 4 continued straight
  // down to the entry tip; free outer flank straight, the source's taper.
  // The continuation's slope is the least that clears every pin disc below
  // the tip line (the pins' reversal corner lies against this flank).
  const c4=cusps[3];let entrySlope=0;
  for(let i=1;i<=rows;i++){const y=tip-(tip-entryTip)*i/rows;let x=-Infinity;
    for(const [px,py]of upper){const dy=y-py;if(Math.abs(dy)>=R||px<c4-pitch/2||px>c4+pitch)continue;x=Math.max(x,px+Math.sqrt(R*R-dy*dy));}
    if(x>-Infinity)entrySlope=Math.max(entrySlope,(x-c4-half0)/(tip-y));}
  {const c=c4,left=flank(c,1),corner=[c+half0+entrySlope*(tip-entryTip),entryTip];
   const outerTip=[top[0][2].x,entryTip],outerRoot=[top[0][3].x+(top[0][3].x-top[0][2].x)*(overlap/(edge-entryTip)),rise];
   teeth.push({index:0,outline:[corner,...left,[c,rise],outerRoot,outerTip],tipHeight:entryTip});}
  for(let k=3;k>=1;k--){const a=cusps[k-1],b=cusps[k];
    teeth.push({index:4-k,outline:[...flank(a,1),[a,rise],[b,rise],...flank(b,-1).reverse()],tipHeight:tip});}
  {const b=cusps[0],right=flank(b,-1).reverse(),x0=b-half0-(pitch-2*half0);// symmetric tip width
   teeth.push({index:4,outline:[[x0,tip],[x0-slope*(rise-tip),rise],[b,rise],...right],tipHeight:tip});}
  return {teeth,slope,half0,entrySlope};
}
const rotate=([x,y])=>[+(pitch*5-x).toFixed(10),+(-y).toFixed(10)];
const clean=o=>o.map(([x,y])=>[+x.toFixed(10),+y.toFixed(10)]).filter((p,i,a)=>i===0||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);
function audit(teeth){let minimum=Infinity;
  const outlines=[];for(const t of teeth){outlines.push(t.outline);outlines.push(t.outline.map(rotate));}
  const boxes=outlines.map(o=>[Math.min(...o.map(p=>p[0]))-r,Math.max(...o.map(p=>p[0]))+r,Math.min(...o.map(p=>p[1]))-r,Math.max(...o.map(p=>p[1]))+r]);
  for(const [x,y]of all)outlines.forEach((o,i)=>{const b=boxes[i];if(x>=b[0]&&x<=b[1]&&y>=b[2]&&y<=b[3])minimum=Math.min(minimum,gapTo([x,y],o));});
  return minimum;}
// Lowest flat tip that no pin disc touches.
let tip=null,design=null;
for(let y=.65;y<.72;y+=.0025){const b=build(y);const gap=audit(b.teeth.map(t=>({outline:clean(t.outline)})));if(process.env.DEBUG)console.log(y.toFixed(4),gap,b.half0,b.entrySlope);if(gap>=0){tip=+y.toFixed(4);design=b;break;}}
assert.ok(tip!==null,'no clear flat tip height');
const result=[];
for(const t of design.teeth){const o=clean(t.outline);
  result.push({side:1,index:t.index,outline:o,tipHeight:t.tipHeight,rootHeight:edge});
  result.push({side:-1,index:t.index,outline:o.map(rotate).map(([x,y])=>[x,y]),tipHeight:t.tipHeight,rootHeight:edge});}
result.sort((a,b)=>b.side-a.side||a.index-b.index);
const minimumGap=audit(result.filter(t=>t.side>0));
const template=templateRows(tip).map(([y,h])=>[+y.toFixed(10),+h.toFixed(10)]);
const data={poses,rows,clearance,pinRadius:r,pitch,cusps,cuspHeight:+cuspY.toFixed(10),rootArcRadius:R,tipHeight:tip,
  flankSlope:+design.slope.toFixed(10),entryFlankSlope:+design.entrySlope.toFixed(10),rackEdge:edge,overlap,minimumGap:+minimumGap.toFixed(8),template,teeth:result};
const output=`// Generated by scripts/generate-partial-lantern-rack.mjs.\nexport default ${JSON.stringify(data)};\n`;
const file=new URL('../src/simulation/baked/partial-lantern-rack.js',import.meta.url);
if(process.argv.includes('--check'))assert.equal(await readFile(file,'utf8'),output);else await writeFile(file,output);
console.log({tip,cuspY,apex,half0:design.half0,slope:design.slope,entrySlope:design.entrySlope,minimumGap,vertices:result.reduce((n,t)=>n+t.outline.length,0),bytes:output.length});
