import {PerspectiveCamera} from 'three';
import {AU} from './catalog';

/** Simulation/camera controls use AU; GPU world/view calculations use metres.
 * Three.js log depth uses log2(1 + clip.w). With clip.w≈1e−9 AU,
 * float32 rounds that sum to 1 and all nearby spacecraft fragments get depth 0.
 * Metre units preserve fine depth separation, even with a solar-system far plane. */
export const RENDER_UNITS_PER_AU=1000*AU;
export function updateRenderCamera(camera:PerspectiveCamera,renderCamera:PerspectiveCamera){
 renderCamera.copy(camera);
 renderCamera.position.multiplyScalar(RENDER_UNITS_PER_AU);
 renderCamera.near=camera.near*RENDER_UNITS_PER_AU;
 renderCamera.far=camera.far*RENDER_UNITS_PER_AU;
 renderCamera.updateProjectionMatrix();renderCamera.updateMatrixWorld(true);
}
