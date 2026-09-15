import fs from 'node:fs';
const p=JSON.parse(fs.readFileSync('/dev/shm/142-gear-profile.json'));
const path=(points,angle,center)=>'M'+points.map(([x,y])=>[center[0]+100*(x*Math.cos(angle)-y*Math.sin(angle)),center[1]-100*(x*Math.sin(angle)+y*Math.cos(angle))].map(x=>x.toFixed(3)).join(',')).join('L')+'Z';
const png=fs.readFileSync('public/engravings/mm_142.png').toString('base64');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="525" height="525"><image xlink:href="data:image/png;base64,${png}" width="525" height="525"/><g fill="none" stroke="#e34b35" stroke-width=".9"><circle cx="268" cy="209" r="178"/><path d="${path(p.sun,p.sunPhase,[268,209])}"/><path d="${path(p.planet,p.planetPhase,[270,302])}"/></g><g fill="none" stroke="#008b66" stroke-width="1"><path d="M270,302L272,405"/>${[[268,209],[270,302],[272,405]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2"/>`).join('')}</g></svg>`;
fs.writeFileSync('docs/validation/142-gear-overlay.svg',svg);
