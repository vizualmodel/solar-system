import {startModelDevelopment} from '@vizualmodel/model-development/server';
import {config} from '../model-service/config.ts';
await startModelDevelopment({...config,openBrowser:false});
