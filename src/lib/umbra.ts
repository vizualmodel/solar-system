import { Vector3 } from 'three';

/** External common tangents of the displayed Sun and Moon spheres. Units: AU. */
export function moonUmbra(sun:Vector3,moon:Vector3,sunRadius:number,moonRadius:number){
 const axis=moon.clone().sub(sun),distance=axis.length();
 if(!Number.isFinite(distance)||sunRadius<=moonRadius||moonRadius<=0||distance<=sunRadius+moonRadius)return null;
 axis.divideScalar(distance);
 const sine=(sunRadius-moonRadius)/distance,cosine=Math.sqrt(1-sine*sine);
 const apexDistance=moonRadius/sine,slope=sine/cosine;
 const baseOffset=moonRadius*sine,baseRadius=moonRadius*cosine;
 return {axis,apexDistance,slope,baseRadius,length:apexDistance-baseOffset,
  base:moon.clone().addScaledVector(axis,baseOffset)};
}

/** Same membership rule used by the Earth surface shader. */
export function insideUmbra(point:Vector3,moon:Vector3,cone:NonNullable<ReturnType<typeof moonUmbra>>){
 const relative=point.clone().sub(moon),axial=relative.dot(cone.axis);
 const radius=(cone.apexDistance-axial)*cone.slope;
 return axial>=0&&axial<=cone.apexDistance&&relative.addScaledVector(cone.axis,-axial).lengthSq()<=radius*radius;
}

/** Internal common tangents: the penumbra widens indefinitely away from the Sun. */
export function moonPenumbra(sun:Vector3,moon:Vector3,sunRadius:number,moonRadius:number){
 const axis=moon.clone().sub(sun),distance=axis.length();
 if(!Number.isFinite(distance)||sunRadius<=0||moonRadius<=0||distance<=sunRadius+moonRadius)return null;
 axis.divideScalar(distance);
 const sine=(sunRadius+moonRadius)/distance,cosine=Math.sqrt(1-sine*sine);
 const apexDistance=moonRadius/sine,slope=sine/cosine,baseOffset=-moonRadius*sine;
 return {axis,apexDistance,slope,baseRadius:moonRadius*cosine,baseOffset,
  base:moon.clone().addScaledVector(axis,baseOffset)};
}
