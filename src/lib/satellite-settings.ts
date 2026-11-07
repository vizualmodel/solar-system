import {satelliteMagnification} from './satellites';
import type {ViewConfig} from './simulation-state';

export function sharedSatelliteSize(view:ViewConfig):number|null{
 const iss=satelliteMagnification(view,'iss'),hubble=satelliteMagnification(view,'hubble');
 return iss===hubble?iss:null;
}
export function satelliteSizePatch(view:ViewConfig,value:number):Partial<ViewConfig>{
 if(!Number.isFinite(value)||value<1||value>100000)throw new Error('Invalid satellite magnification.');
 return {satelliteSize:value,satelliteSizes:{...view.satelliteSizes,iss:value,hubble:value}};
}
