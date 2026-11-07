import * as THREE from 'three';

// Seven loose authoring cylinders in NASA ISS (B), all at y≈41 source units.
// The station itself spans y≈−4..26. These are not spacecraft components.
export const ISS_AUTHORING_DEBRIS=new Set(['bendedtru1','bendedtru2','bendedtru3','bendedtrus','pCylinder1','pCylinder2','pCylinder8']);
const profiles={
 insulation:{color:0xd6d3c8,metalness:0.06,roughness:0.82},
 aluminium:{color:0x9da9b1,metalness:0.78,roughness:0.38},
 radiator:{color:0xe0dfd6,metalness:0.08,roughness:0.72},
 foil:{color:0xaa8851,metalness:0.72,roughness:0.58},
 solar:{color:0x754325,metalness:0.32,roughness:0.59},
 glass:{color:0x102536,metalness:0.25,roughness:0.24},
 equipment:{color:0x46514c,metalness:0.24,roughness:0.72},
};
type Profile=keyof typeof profiles;
// The source's distinct material slots survive, but their original identical gray
// Blinn placeholders are replaced by untextured, opaque PBR materials.
const assignments:Record<string,Profile>={
 blinn5SG:'insulation',blinn3SG:'aluminium',blinn1SG:'insulation',lambert3SG:'radiator',
 lambert4SG:'foil',blinn4SG:'aluminium',soyuz_blinn2SG:'equipment',blinn7SG:'glass',
 soyuz_blinn3SG:'glass',blinn6SG:'glass',bendedtruss_blin:'aluminium',lambert6SG:'foil',
 lambert2SG:'glass',initialShadingGr:'insulation',anisotropic1SG:'aluminium',
 apollohorns_blin:'foil',lambert7SG:'solar',soyuz_blinn4SG:'radiator',
};
export function prepareIssModel(model:THREE.Object3D){
 const debris:THREE.Object3D[]=[],oldMaterials=new Set<THREE.Material>();
 model.traverse(object=>{if(ISS_AUTHORING_DEBRIS.has(object.name))debris.push(object);});
 for(const object of debris){object.removeFromParent();object.traverse(part=>{if(part instanceof THREE.Mesh){part.geometry.dispose();for(const material of Array.isArray(part.material)?part.material:[part.material])oldMaterials.add(material);}});}
 const replacements=new Map<THREE.Material,THREE.MeshStandardMaterial>();
 model.traverse(object=>{if(object instanceof THREE.Mesh){
  const replace=(source:THREE.Material)=>{
   let material=replacements.get(source);if(material)return material;
   const key=source.name.replace(/\.\d+$/,''),profile=assignments[key]??'insulation';
   material=new THREE.MeshStandardMaterial({...profiles[profile],side:THREE.DoubleSide});
   material.name=`ISS ${profile}`;material.userData.sourceMaterial=source.name;
   replacements.set(source,material);oldMaterials.add(source);return material;
  };
  object.material=Array.isArray(object.material)?object.material.map(replace):replace(object.material);
 }});
 oldMaterials.forEach(material=>material.dispose());
 // Match the procedural LOD: truss along X, thickness along Y, modules along Z.
 model.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0)));
}
