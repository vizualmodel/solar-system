import {build} from 'esbuild';import {mkdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';
const out=process.argv[2];if(!out)throw Error('Output directory required');await mkdir(out,{recursive:true});
await build({entryPoints:['examples/counter/client.ts'],bundle:true,format:'esm',outfile:join(out,'app.js'),platform:'browser'});
await writeFile(join(out,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><title>Companion counter example</title></head><body><h1>Counter: <span id="count">0</span></h1><button id="increment">+1</button><p id="status"></p><pre id="history"></pre><form><textarea aria-label="Message" rows="8"></textarea><button>Send</button></form><script type="module" src="/app.js"></script></body></html>');
