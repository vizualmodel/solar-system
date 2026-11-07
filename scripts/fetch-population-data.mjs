import {writeFile,rename,readFile} from 'node:fs/promises';
import {json2satrec,sgp4} from 'satellite.js';
import {parseArgs} from 'node:util';

// Run explicitly; the browser never contacts CelesTrak. Replace only a complete cache.
const {values,positionals}=parseArgs({args:process.argv.slice(2),options:{'cache-proxy':{type:'boolean',default:false}},allowPositionals:true});
if(positionals.length>1)throw new Error('Usage: node scripts/fetch-population-data.mjs [output.json] [--cache-proxy]');
const path=positionals[0]??'src/data/satellite-population.json';
let existing;
try{existing=JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(existing&&Date.now()-Date.parse(existing.fetchedAt)<2*3600000)throw new Error('Cache is less than two hours old; retained without contacting CelesTrak.');
// Detect denied writes before consuming a provider download.
await writeFile(path+'.tmp','','utf8');
const sources=[];
const records=new Map();
for(const group of ['active','geo','gnss']){
 const sourceUrl=`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=JSON`;
 const url=values['cache-proxy']?`https://retlector.eu/${group}/json`:sourceUrl;
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`CelesTrak ${group}: HTTP ${response.status}; cache retained.`);
 const rows=await response.json();
 if(!Array.isArray(rows)||!rows.length)throw new Error(`Empty ${group}; cache retained.`);
 for(const row of rows){
  const numeric=['NORAD_CAT_ID','MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT'];
  if(numeric.some(k=>row[k]===null||row[k]===''||!Number.isFinite(Number(row[k])))||typeof row.EPOCH!=='string'||!Number.isFinite(Date.parse(row.EPOCH.replace(/Z$/,'')+'Z'))||typeof row.OBJECT_NAME!=='string'||!Number.isInteger(Number(row.NORAD_CAT_ID))||row.NORAD_CAT_ID<=0||row.NORAD_CAT_ID>999999999||row.MEAN_MOTION<=0||row.ECCENTRICITY<0||row.ECCENTRICITY>=1)throw new Error(`Invalid OMM in ${group}; cache retained.`);
  const state=sgp4(json2satrec(row),0);
  if(!state||Object.values(state.position).some(v=>!Number.isFinite(v)))continue;
  const previous=records.get(Number(row.NORAD_CAT_ID));
  const elements=previous&&Date.parse(previous.elements.EPOCH.replace(/Z$/,'')+'Z')>Date.parse(row.EPOCH.replace(/Z$/,'')+'Z')?previous.elements:row;
  records.set(Number(row.NORAD_CAT_ID),{elements,groups:[...new Set([...(previous?.groups??[]),group])]});
 }
 sources.push({group,url,sourceUrl,count:rows.length});
}
await writeFile(path+'.tmp',JSON.stringify({source:'CelesTrak GP / OMM JSON',fetchedAt:new Date().toISOString(),sources,records:[...records.values()]})+'\n','utf8');
await rename(path+'.tmp',path);
console.log(`Cached ${records.size} unique satellites. Build and activate to display.`);
