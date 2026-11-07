import {mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// Solar System Scope / INOVE, CC BY 4.0. These registered equirectangular maps
// use the same longitude convention as the application's original Earth map.
await mkdir('public/textures/earth',{recursive:true});
const sources={day:'earth_daymap',clouds:'earth_clouds',night:'earth_nightmap',normal:'earth_normal_map',ocean:'earth_specular_map'};
const provenance={source:'https://www.solarsystemscope.com/textures/',license:'https://creativecommons.org/licenses/by/4.0/',credit:'Solar System Scope / INOVE',maps:{}};
const staging=await mkdtemp(join(tmpdir(),'earth-textures-'));
for(const [id,name] of Object.entries(sources)){
 const resolution=id==='day'||id==='clouds'||id==='night'?'8k':'2k';
 const tiff=id==='normal'||id==='ocean';
 const url=`https://www.solarsystemscope.com/textures/download/${resolution}_${name}.${tiff?'tif':'jpg'}`;
 const response=await fetch(url);if(!response.ok)throw new Error(`${id}: ${response.status} ${url}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(!tiff&&(bytes[0]!==255||bytes[1]!==216))throw new Error('Not a JPEG: '+id);
 const file=tiff?join(staging,id+'.tif'):id==='clouds'||id==='night'?join(staging,`${id}-8k.jpg`):`public/textures/earth/${id}-${resolution}.jpg`;await writeFile(file,bytes);
 provenance.maps[id]={url,file};console.log(id,bytes.length);
}
// Prepare actual 4K files, so fallback devices never download/decode the 8K map.
// System.Drawing is used only for offline texture resampling on Windows.
execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`
 Add-Type -AssemblyName System.Drawing
 foreach($name in @('normal','ocean')) {
  $image=[Drawing.Image]::FromFile((Join-Path '${staging.replaceAll("'","''")}' "$name.tif"))
  $image.Save((Join-Path $pwd "public/textures/earth/$name-2k.png"),[Drawing.Imaging.ImageFormat]::Png)
  $image.Dispose()
 }
 foreach($name in @('day','clouds','night')) {
  $path=if($name -eq 'day'){Join-Path $pwd 'public/textures/earth/day-8k.jpg'}else{Join-Path '${staging.replaceAll("'","''")}' "$name-8k.jpg"}
  $source=[Drawing.Image]::FromFile($path)
  $widths=if($name -eq 'day'){@(4096)}else{@(4096,2048)}
  foreach($width in $widths){
  $target=[Drawing.Bitmap]::new($width,($width/2))
  $graphics=[Drawing.Graphics]::FromImage($target)
  $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($source,0,0,$width,($width/2))
  $codec=[Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object {$_.MimeType -eq 'image/jpeg'}
  $parameters=[Drawing.Imaging.EncoderParameters]::new(1)
  $parameters.Param[0]=[Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality,[long]92)
  $label=[int]($width/1024)
  $target.Save((Join-Path $pwd "public/textures/earth/$name-$($label)k.jpg"),$codec,$parameters)
  $parameters.Dispose(); $graphics.Dispose(); $target.Dispose()
  }
  $source.Dispose()
 }
`],{windowsHide:true,stdio:'inherit'});
for(const id of ['normal','ocean'])provenance.maps[id].file=`public/textures/earth/${id}-2k.png`;
for(const id of ['clouds','night'])provenance.maps[id].file=`public/textures/earth/${id}-4k.jpg`;
await writeFile('public/textures/earth/sources.json',JSON.stringify(provenance,null,2)+'\n');
