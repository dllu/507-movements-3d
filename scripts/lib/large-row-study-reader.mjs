import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';

// The study writer places its rows array last. Decode that array in complete
// JSON batches so a long trajectory never needs one V8-sized string. Buffers
// and parsed rows still reside in memory; this is not an out-of-core reader.
export function readLargeRowStudyReport(file,{chunkBytes=16*1024*1024}={}){
  if(!Number.isSafeInteger(chunkBytes)||chunkBytes<1)throw Error('Invalid JSON batch size');
  const compressed=fs.readFileSync(file),bytes=file.endsWith('.gz')?gunzipSync(compressed):compressed,
    marker=Buffer.from(',"rows":[');
  let at=-1,header;
  while((at=bytes.indexOf(marker,at+1))>=0){
    // A similarly named nested member is not the top-level rows member.
    try{header=JSON.parse(bytes.subarray(0,at).toString('utf8')+'}');break;}catch{}
  }
  if(at<0)throw Error('Expected study writer format with final top-level rows array');
  const rows=[];let start=at+marker.length,depth=0,quoted=false,escaped=false,closed=false;
  function append(end){
    if(end===start)return;
    const batch=JSON.parse('['+bytes.subarray(start,end).toString('utf8')+']');
    for(const row of batch)rows.push(row);
  }
  for(let i=start;i<bytes.length;i++){
    const c=bytes[i];
    if(quoted){if(escaped)escaped=false;else if(c===92)escaped=true;else if(c===34)quoted=false;continue;}
    if(c===34){quoted=true;continue;}
    if(c===93&&depth===0){
      append(i);if(bytes.subarray(i+1).toString('utf8').trim()!=='}')throw Error('Rows must be the final report member');
      closed=true;break;
    }
    if(c===123||c===91)depth++;
    else if(c===125||c===93){if(--depth<0)throw Error('Unbalanced row JSON');}
    else if(c===44&&depth===0&&i-start>=chunkBytes){append(i);start=i+1;}
  }
  if(!closed)throw Error('Unterminated study rows');
  return{...header,rows};
}
