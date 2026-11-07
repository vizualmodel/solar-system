import {readFileSync} from 'node:fs';
import {Object3D,Box3,Vector3} from 'three';
for(const id of ['iss','hubble']){
 const b=readFileSync(`public/models/${id}.glb`),j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12))),box=new Box3();
 const nodes=j.nodes.map(n=>{const o=new Object3D();if(n.matrix)o.matrix.fromArray(n.matrix).decompose(o.position,o.quaternion,o.scale);else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
 j.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));
 const root=new Object3D();j.scenes[j.scene??0].nodes.forEach(i=>root.add(nodes[i]));root.updateMatrixWorld(true);
 j.nodes.forEach((n,i)=>{if(n.mesh!==undefined)for(const p of j.meshes[n.mesh].primitives){const a=j.accessors[p.attributes.POSITION];box.union(new Box3(new Vector3(...a.min),new Vector3(...a.max)).applyMatrix4(nodes[i].matrixWorld));}});
 console.log(id,box.getSize(new Vector3()).toArray(),j.meshes.reduce((s,m)=>s+m.primitives.reduce((s,p)=>s+j.accessors[p.indices].count/3,0),0),'triangles');
}
