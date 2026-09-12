// Long refinements exceed the argument limit of Math.min(...rows). Keep
// summary construction bounded independently of the trajectory length.
export function summarizePumpCatchRows(rows){
  if(!rows.length)throw Error('Cannot summarize an empty pump trajectory');
  const range=Array.from({length:3},()=>[Infinity,-Infinity]);let maximumSlack=-Infinity;
  for(const row of rows){
    for(let k=0;k<3;k++){range[k][0]=Math.min(range[k][0],row.q[k]);range[k][1]=Math.max(range[k][1],row.q[k]);}
    maximumSlack=Math.max(maximumSlack,row.slack);
  }
  return{states:rows.length,actualEnd:rows.at(-1).time,range,maximumSlack};
}
