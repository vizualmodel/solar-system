import {mkdir,writeFile} from 'node:fs/promises';
const url='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc';
const response=await fetch(url);if(!response.ok)throw new Error(`PCK download: ${response.status}`);
const source=await response.text();
const active=source.split('\\begindata').slice(1).map(s=>s.split('\\begintext')[0]).join('\n');
const ids={sun:10,mercury:199,venus:299,earth:399,mars:499,jupiter:599,saturn:699,uranus:799,neptune:899,moon:301,phobos:401,deimos:402,io:501,europa:502,ganymede:503,callisto:504,titan:606,enceladus:602,titania:703,oberon:704,triton:801};
const models={};
for(const [id,code] of Object.entries(ids)){
 const model={};
 for(const [field,key] of [['ra','POLE_RA'],['dec','POLE_DEC'],['w','PM']]){
  const matches=[...active.matchAll(new RegExp(`BODY${code}_${key}\\s*=\\s*\\(([^)]+)\\)`,'g'))];
  if(!matches.length)throw new Error(`Missing ${id} ${key}`);
  const values=matches.at(-1)[1].trim().split(/\s+/).map(s=>Number(s.replace(/[dD]/,'e')));
  if(values.length!==3||values.some(v=>!Number.isFinite(v)))throw new Error(`Invalid ${id} ${key}`);
  model[field]=values;
 }
 models[id]=model;
}
await mkdir('src/data',{recursive:true});
await writeFile('public/data/pck00011.tpc',source);
await writeFile('src/data/rotation.json',JSON.stringify({source:url,description:'Polynomial IAU pole and prime meridian terms; periodic nutation/libration terms omitted.',models},null,2)+'\n');
console.log(`Extracted ${Object.keys(models).length} rotation models`);
