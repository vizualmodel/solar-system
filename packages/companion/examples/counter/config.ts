import { fileURLToPath } from 'node:url';
import type { CompanionConfig } from '../../src/contracts';
import { tools } from './tools'; import { state } from './adapter';
export const config: CompanionConfig = {
 application:{id:'example/counter',name:'Counter'},root:fileURLToPath(new URL('../../',import.meta.url)),port:5181,storageDirectory:'.companion/counter',
 runtime:{mcpName:'counter',mcpEntry:'examples/counter/mcp.ts',instructions:'Use the counter tools for live observations and changes.'},
 tools,state,validation:[{name:'Counter type checks',args:[fileURLToPath(import.meta.resolve('typescript/bin/tsc')),'--noEmit','-p','tsconfig.json']}],
 build:{args:['examples/counter/build.mjs','{outDir}']}
};
