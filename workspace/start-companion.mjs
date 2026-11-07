// Convenience launcher: no source modifications to either existing repository.
import { startCompanion } from '@vizualmodel/companion/server';
import { config } from '../companion/config.ts';
await startCompanion({...config,openBrowser:false,...(process.argv.includes('--no-agent')?{agent:false}:{})});
