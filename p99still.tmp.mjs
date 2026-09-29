import { chromium } from '@playwright/test';
const id=process.argv[2];
const b = await chromium.launch({channel:'chrome'});
const p = await b.newPage({viewport:{width:1440,height:1000}});
await p.emulateMedia({reducedMotion:'reduce'});
await p.goto('http://127.0.0.1:43917/portable/#/movement/'+id);
const c=p.locator('.simulation-canvas'); await c.waitFor();
const shots=[];
for(let i=0;i<8;i++){ shots.push(await c.screenshot()); await p.waitForTimeout(250);}
console.log('still frames equal to previous:', shots.map((s,i)=>i?s.equals(shots[i-1]):'-').join(' '));
const fs=await import('fs'); shots.forEach((s,i)=>fs.writeFileSync(`/tmp/p99still-${id}-${i}.png`,s));
await b.close();
