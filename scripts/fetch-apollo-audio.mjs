import {mkdir,writeFile,readFile} from 'node:fs/promises';
const source='https://www.nasa.gov/historical-sounds/';
const clips=[
 {id:'launch',title:'We have a lift-off',url:'https://www.nasa.gov/wp-content/uploads/2015/01/590320main_ringtone_apollo11_countdown.mp3'},
 {id:'landing',title:'Eagle has landed',url:'https://www.nasa.gov/wp-content/uploads/2015/01/569462main_eagle_has_landed.mp3'},
 {id:'landing-extended',title:'Eagle has landed — extended crew/ground exchange',url:'https://www.nasa.gov/wp-content/uploads/2015/01/590333main_ringtone_eagleHasLanded_extended.mp3'}
];
await mkdir('public/audio/apollo-11',{recursive:true});
for(const clip of clips){const path=`public/audio/apollo-11/${clip.id}.mp3`;try{await readFile(path);continue;}catch{}
 const response=await fetch(clip.url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`NASA audio: ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<1000||!response.headers.get('content-type')?.includes('audio'))throw Error('Invalid NASA audio');await writeFile(path,bytes);console.log(`${clip.id}: ${bytes.length} bytes`);
}
await writeFile('public/audio/apollo-11/credits.json',JSON.stringify({credit:'NASA · Apollo 11 historical mission recordings',source,clips},null,2)+'\n');
