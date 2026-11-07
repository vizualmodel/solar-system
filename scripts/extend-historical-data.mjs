import {readFile,writeFile} from 'node:fs/promises';
const file='public/data/ephemeris.json',data=JSON.parse(await readFile(file,'utf8'));
const targets=[['mercury',199,10],['venus',299,10],['earth',399,10],['mars',499,10],['jupiter',599,10],['saturn',699,10],['uranus',799,10],['neptune',899,10],['moon',301,399],['phobos',401,499],['deimos',402,499],['io',501,599],['europa',502,599],['ganymede',503,599],['callisto',504,599],['titan',606,699],['enceladus',602,699],['titania',703,799],['oberon',704,799],['triton',801,899]];
// Preserve every accepted 2025–2031 sample. Only prepend historical Horizons data.
for(const [id,target,center] of targets){
 const params=new URLSearchParams({format:'json',COMMAND:`'${target}'`,CENTER:`'500@${center}'`,MAKE_EPHEM:"'YES'",EPHEM_TYPE:"'ELEMENTS'",START_TIME:"'1990-01-01'",STOP_TIME:"'2025-01-02'",STEP_SIZE:center===10?"'8 d'":"'1 d'",OUT_UNITS:"'AU-D'",REF_PLANE:"'ECLIPTIC'",REF_SYSTEM:"'ICRF'",CSV_FORMAT:"'YES'"});
 const response=await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?'+params);
 if(!response.ok)throw new Error(`${id}: ${response.status}`);
 const payload=await response.json(),raw=payload.result;if(!raw?.includes('$$SOE'))throw new Error(JSON.stringify(payload));
 const rows=raw.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n').map(line=>{const c=line.split(',').map(s=>s.trim());return [0,2,4,5,6,8,9,11].map(i=>Number(c[i]));});
 if(rows.some(r=>r.some(x=>!Number.isFinite(x))))throw new Error('Invalid elements: '+id);
 data.bodies[id]=[...rows.filter(r=>r[0]<data.bodies[id][0][0]),...data.bodies[id]];console.log(id,rows.length);
}
data.start='1990-01-01';data.historicalRetrieved=new Date().toISOString();
await writeFile(file,JSON.stringify(data));
