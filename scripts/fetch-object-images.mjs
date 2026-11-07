import {mkdir,writeFile,readFile} from 'node:fs/promises';
// Curated NASA landing pages; their preview images are bundled for offline dialogs.
const content=await readFile('src/data/object-info.ts','utf8');
const entries=[...content.matchAll(/^ (\w+):\{.*?source:'([^']+)'/gm)].map(m=>[m[1],m[2]]);
await mkdir('public/images/objects',{recursive:true});
const metadata={};
for(const [id,page] of entries){
 const response=await fetch(page);if(!response.ok)throw new Error(`${id}: page ${response.status}`);
 const html=await response.text();
 const tags=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]);
 const tag=tags.find(t=>/property=["']og:image["']/.test(t));
 const url=tag?.match(/content=["']([^"']+)["']/)?.[1]?.replaceAll('&amp;','&');
 if(!url)throw new Error(`${id}: missing preview image`);
 const image=await fetch(url);if(!image.ok)throw new Error(`${id}: image ${image.status}`);
 const type=image.headers.get('content-type')??'',ext=type.includes('png')?'png':type.includes('webp')?'webp':'jpg';
 const bytes=Buffer.from(await image.arrayBuffer());await writeFile(`public/images/objects/${id}.${ext}`,bytes);
 metadata[id]={src:`/images/objects/${id}.${ext}`,source:page,original:url,credit:'Image via NASA · full credits at source'};
 console.log(id,bytes.length,url);
}
await writeFile('src/data/object-images.json',JSON.stringify(metadata,null,2)+'\n');
