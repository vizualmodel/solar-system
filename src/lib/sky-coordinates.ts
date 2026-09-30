import type { Vec3 } from './ephemeris';

export const J2000_OBLIQUITY = 23.439291111 * Math.PI / 180;

// Shared by the shader and coordinate tests: scene (x,y,z) = ecliptic (x,z,-y).
export const SKY_EQUATORIAL_GLSL = `
vec3 sceneToEquatorial(vec3 direction) {
  float c = cos(obliquity), s = sin(obliquity);
  return vec3(direction.x, -c * direction.z - s * direction.y,
              -s * direction.z + c * direction.y);
}`;

export function equatorialToScene(ra:number,dec:number):Vec3 {
  const x=Math.cos(dec)*Math.cos(ra),y=Math.cos(dec)*Math.sin(ra),z=Math.sin(dec);
  const c=Math.cos(J2000_OBLIQUITY),s=Math.sin(J2000_OBLIQUITY);
  return [x,-s*y+c*z,-c*y-s*z];
}

export function skyUV(direction:Vec3):[number,number] {
  const length=Math.hypot(...direction),[x,y,z]=direction.map(v=>v/length);
  const c=Math.cos(J2000_OBLIQUITY),s=Math.sin(J2000_OBLIQUITY);
  const ra=Math.atan2(-c*z-s*y,x),dec=Math.asin(Math.max(-1,Math.min(1,-s*z+c*y)));
  return [((0.5-ra/(2*Math.PI))%1+1)%1,0.5+dec/Math.PI];
}
