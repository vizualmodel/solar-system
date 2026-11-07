import { writeFile } from 'node:fs/promises';
import { json2satrec,sgp4 } from 'satellite.js';

for(const [id,norad] of [['hubble',20580],['iss',25544]]){
const sourceUrl=`https://celestrak.org/NORAD/elements/gp.php?CATNR=${norad}&FORMAT=JSON`;
const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(20000)});
if(!response.ok)throw new Error(`CelesTrak returned ${response.status}; the existing snapshot was retained.`);
const rows=await response.json();
if(!Array.isArray(rows)||rows.length!==1||Number(rows[0].NORAD_CAT_ID)!==norad)throw new Error(`Unexpected ${id} response; snapshot retained.`);
const elements=rows[0],epoch=Date.parse(elements.EPOCH.endsWith('Z')?elements.EPOCH:elements.EPOCH+'Z');
for(const key of ['MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT'])if(!Number.isFinite(Number(elements[key])))throw new Error(`Invalid ${key}; snapshot retained.`);
if(!Number.isFinite(epoch)||epoch<Date.parse('2025-01-01T00:00:00Z')||epoch>Date.parse('2031-01-01T00:00:00Z'))throw new Error('Epoch outside simulation range; snapshot retained.');
const state=sgp4(json2satrec(elements),0);
if(!state||Object.values(state.position).some(v=>!Number.isFinite(v))||Math.hypot(...Object.values(state.position))<6371)throw new Error('Invalid orbit; snapshot retained.');
await writeFile(`src/data/${id}.json`,JSON.stringify({source:'CelesTrak GP / NORAD',sourceUrl,elements},null,2)+'\n');
console.log(`${id} snapshot refreshed: ${new Date(epoch).toISOString()}. Build and activate a new candidate to display it.`);
}
