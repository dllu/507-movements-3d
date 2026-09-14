import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements;
const records=[],queue=[...catalog];
await Promise.all(Array.from({length:4},async()=>{
 while(queue.length){
  const movement=queue.shift(),url=movement.sourceUrl;
  let result;
  for(let attempt=0;attempt<3;attempt++){
   try{const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);const html=await response.text();result={id:movement.id,url,animated:/\badd_model\s*\(/.test(html)};break;}
   catch(error){if(attempt===2)throw new Error(url+': '+error.message);}
  }
  records.push(result);if(records.length%50===0)console.log({checked:records.length});
 }
}));
records.sort((a,b)=>a.id-b.id);
const output={checkedAt:new Date().toISOString(),detection:'Animation model registration in the original page HTML. Availability is a reference index, not a correctness verdict.',movements:records};
fs.writeFileSync('src/data/source-animations.json',JSON.stringify(output,null,2)+'\n');
console.log({checked:records.length,animated:records.filter(r=>r.animated).length,remainingAnimated:records.filter(r=>r.id>126&&r.animated).length});
