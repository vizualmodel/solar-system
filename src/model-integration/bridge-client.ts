import {createModelClient} from '@vizualmodel/bridge-model-client';
import {createBrowserActionAdapter} from './browser-adapter';
import {modelDescriptor} from './manifest';
export function createBridgeClient(onEvent:(value:any)=>void){return createModelClient({descriptor:modelDescriptor,createAdapter:()=>createBrowserActionAdapter(__MODEL_BUILD__,__MODEL_DATA__),onEvent});}
