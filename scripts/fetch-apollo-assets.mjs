import {mkdir,writeFile,readFile} from 'node:fs/promises';
await mkdir('public/models/apollo',{recursive:true});
for(const [id,url] of Object.entries({saturn:'https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/saturn-v/Saturn%20V.glb',lm:'https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/apollo-lunar-module/Apollo%20Lunar%20Module.glb'})){
 const path=`public/models/apollo/${id}.glb`;
 try{await readFile(path);continue;}catch{}
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`${id}: ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.toString('ascii',0,4)!=='glTF')throw new Error('Not a GLB');
 await writeFile(path,bytes);console.log(`${id}: ${bytes.length} bytes`);
}
// Dedicated historical context for the mission; the normal observatory range is unchanged.
await mkdir('public/data/missions',{recursive:true});
const file='public/data/missions/apollo-11.json';
try{await readFile(file);console.log('Historical context already cached');}catch{
 const result={source:'NASA/JPL Horizons',frame:'J2000 ecliptic, km, Earth relative to Sun and Moon relative to Earth',timeType:'UT',start:'1969-07-16T00:00:00Z',end:'1969-07-25T00:00:00Z',retrieved:new Date().toISOString(),bodies:{}};
 for(const [id,target,center] of [['earth',399,10],['moon',301,399]]){
  const params=new URLSearchParams({format:'json',COMMAND:`'${target}'`,CENTER:`'500@${center}'`,MAKE_EPHEM:"'YES'",EPHEM_TYPE:"'VECTORS'",START_TIME:"'1969-07-16'",STOP_TIME:"'1969-07-25'",STEP_SIZE:"'1 h'",OUT_UNITS:"'KM-S'",REF_PLANE:"'ECLIPTIC'",REF_SYSTEM:"'ICRF'",VEC_TABLE:"'2'",VEC_CORR:"'NONE'",TIME_TYPE:"'UT'",CSV_FORMAT:"'YES'"});
  const sourceUrl='https://ssd.jpl.nasa.gov/api/horizons.api?'+params;
  const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`${id}: ${response.status}`);
  const payload=await response.json(),raw=payload.result;if(!raw?.includes('$$SOE'))throw new Error(JSON.stringify(payload));
  const rows=raw.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n').map(line=>{const c=line.split(',').map(x=>x.trim());return [Number(c[0]),...c.slice(2,8).map(Number)];});
  if(rows.length<200||rows.some(row=>row.length!==7||row.some(x=>!Number.isFinite(x))))throw new Error('Invalid historical context');
  result.bodies[id]={sourceUrl,rows};console.log(`${id}: ${rows.length} historical samples`);
 }
 await writeFile(file,JSON.stringify(result)+'\n');
}
