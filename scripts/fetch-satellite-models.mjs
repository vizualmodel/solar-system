import {mkdir,writeFile,copyFile} from 'node:fs/promises';
const pages={iss:'https://science.nasa.gov/3d-resources/international-space-station-iss-b/',hubble:'https://science.nasa.gov/3d-resources/hubble-space-telescope-a/'};
await mkdir('public/models',{recursive:true});
for(const [id,page] of Object.entries(pages)){
 const html=await (await fetch(page)).text();
 const urls=[...html.matchAll(/(?:href|src)="([^"]+\.glb[^" ]*)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
 const url=urls.find(u=>u.includes('assets.science.nasa.gov'));
 if(!url)throw new Error(`No GLB on ${page}`);
 const response=await fetch(url);if(!response.ok)throw new Error(`${response.status}: ${url}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.toString('ascii',0,4)!=='glTF')throw new Error('Invalid GLB');
 await writeFile(`public/models/${id}.glb`,bytes);
 console.log(id,bytes.length,url);
}
await mkdir('public/models/draco',{recursive:true});
for(const file of ['draco_decoder.js','draco_wasm_wrapper.js','draco_decoder.wasm'])await copyFile('node_modules/three/examples/jsm/libs/draco/gltf/'+file,'public/models/draco/'+file);
const license=await fetch('https://raw.githubusercontent.com/google/draco/main/LICENSE');
if(!license.ok)throw new Error('Could not download Draco license');
await writeFile('public/models/draco/LICENSE.txt',await license.text());
