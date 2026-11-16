import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createWorkspace} from '../src/workspace';
const [application,previous]=process.argv.slice(2);
if(!application||!previous)throw new Error('Usage: node --import tsx scripts/relocate-workspace.ts <new-application-root> <previous-root>');
const {config}=await import(pathToFileURL(join(resolve(application),'companion/config.ts')).href);
console.log(JSON.stringify(await createWorkspace(config).relocateWorkspace(previous),null,2));
