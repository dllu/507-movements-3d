import source from './source.js';
export function makePersianDrillProfile({segments=64,clearance=.001,amplitude=.82}={}) {
 if(!Number.isInteger(segments)||segments<32||!Number.isFinite(clearance)||clearance<=0||clearance>.005||!Number.isFinite(amplitude)||amplitude<=0||amplitude>.9)throw new RangeError('Invalid Persian drill profile');
 const e=source.edges,axis=[source.axis,(e.gripTop+e.gripBottom)/2],y=p=>(axis[1]-p)/100;
 const crest=source.radius/100,core=crest-.018,bore=crest+clearance,pitch=source.thread.pitch/100,lead=pitch*source.thread.starts/(2*Math.PI),groove=.02;
 const groovePhase=y(source.thread.intercept)+lead*Math.PI/2;
 const external=Array.from({length:source.thread.starts},(_,i)=>({inner:core,outer:crest,low:y(e.chuckTop),high:y(e.stockTop),lead,width:pitch-groove,phase:groovePhase+(i+.5)*pitch}));
 const internal=external.map((t,i)=>({...t,inner:core+clearance,outer:bore,low:y(e.gripBottom),high:y(e.gripTop),width:groove-2*clearance,phase:groovePhase+i*pitch}));
 const headRadius=50.8,capHeight=110-e.headTop;
 let numerator=0,denominator=0;
 for(const p of source.profiles.head.filter(p=>p.y<109)){const u=(p.radius/headRadius)**2,x=u-u*u;numerator+=x*(p.y-e.headTop-capHeight*u*u);denominator+=x*x;}
 const capA=numerator/denominator;
 const headPixels=[[e.headBottom,23.65],[132,23.65],[132,16],...Array.from({length:25},(_,i)=>{const yy=132-22*i/24;return [yy,16+16*((132-yy)/22)**2];}).slice(1),[110,headRadius],
  ...Array.from({length:64},(_,i)=>{const r=headRadius*(1-(i+1)/64),u=(r/headRadius)**2;return [e.headTop+capA*u+(capHeight-capA)*u*u,r];}),[123,0],[123,100*(core+clearance)],[e.headBottom,100*(core+clearance)]];
 const gripPixels=[[e.gripBottom,100*bore],[e.gripBottom,44.6],[285.5,44.6],[285.5,34],
  ...Array.from({length:32},(_,i)=>{const yy=285.5-22*(i+1)/32;return [yy,29.8+4.2*((yy-274.5)/11)**2];}),[263.5,44],[261.5,44],
  ...Array.from({length:32},(_,i)=>{const yy=261.5-(261.5-e.gripTop)*(i+1)/32,s=(yy-e.gripTop)/(261.5-e.gripTop);return [yy,44-9*(1-s)**2];}),[e.gripTop,100*bore]];
 const chuckRadius=source.profiles.chuck.reduce((s,p)=>s+p.radius,0)/source.profiles.chuck.length/100;
 const bitRadius=(e.bitRight-e.bitLeft)/200,bitHalf=[[e.chuckBottom,bitRadius*100],[478,bitRadius*100],[484,3],[488,5.5],[490,5],[496.5,0]];
 const bitOutline=[...bitHalf.map(([yy,r])=>[-r/100,y(yy)]),...bitHalf.slice(0,-1).reverse().map(([yy,r])=>[r/100,y(yy)])];
 return {source,axis,y,segments,clearance,amplitude,crest,core,bore,pitch,lead,groove,external,internal,groovePhase,headProfile:headPixels.map(([yy,r])=>[y(yy),r/100]),gripProfile:gripPixels.map(([yy,r])=>[y(yy),r/100]),coreLow:y(e.chuckTop),coreHigh:y(126),chuckRadius,chuckLow:y(e.chuckBottom),chuckHigh:y(e.chuckTop),bitOutline,bitDepth:.04,tip:y(496.5),top:y(e.headTop)};
}
