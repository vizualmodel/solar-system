# Earth at orbital and surface distances

`EarthVisual` replaces Earth's single low-detail sphere with a surface, a cloud shell at approximately 12 km, and an atmospheric scattering shell. All layers inherit the existing body orientation and display scale. Physical positions, camera coordinates, ephemerides and saved simulation state stay unchanged.

Geometry switches between 64, 128, 256 and 512 longitudinal segments according to projected size, with hysteresis to prevent rapid switching near a threshold. The denser levels remove visible faceting at orbital distances. This is a globe, not tiled terrain or a street-level model; topographic detail changes normals rather than the physical silhouette.

The original 2K daytime texture provides the fallback. Approaching Earth loads the detail maps once. Devices advertising at least 8 GB device memory and an 8192-pixel texture limit use an 8K surface plus 4K clouds/night lights when at most two views exist. Others use a 4K surface plus 2K support maps; with four or more views, newly loaded Earth models use the 2K surface. Three.js additionally respects the actual GPU texture limit. Normal and ocean-mask maps are 2K. An existing detail load retains its chosen tier until its view closes.

Decoded texture images and geometry objects are shared across views and released when their last view closes. Each viewport currently owns its own WebGL context, so GPU uploads are per viewport even though CPU image decoding is shared. An 8K RGBA surface with mipmaps alone occupies roughly 171 MiB of GPU memory per context, which is why higher resolutions are not enabled indiscriminately and view count is considered.

Surface shading distinguishes reflective water from rough land and uses a subtle terrain normal map. Night lights fade through the day/night transition and dim under clouds. The cloud shell has soft opacity, sunlight shading and projected ground shadows. Clouds drift through one longitude cycle per 30 simulated days, with a small periodic deformation. Both phases come only from simulation time: pause freezes them and reverse scrubbing retraces them deterministically.

The atmosphere approximates single Rayleigh and Mie scattering with exponential density profiles, sunlight attenuation, Earth shadow and approximate Moon occultation. It produces a blue sunlit limb, horizon haze, forward scattering and a warmer twilight transition. High-detail close-ups use 12 view samples and 4 light samples; the lighter mode uses 8 and 3. It is not a multiple-scattering weather or radiative-transfer solver.

Rendering remains in metres for depth precision. The atmosphere writes the logarithmic depth of its ray entry, rather than the far shell surface. It can therefore cover the ground while remaining behind a nearby ISS or Hubble above the atmosphere. The method approximates foreground occlusion; it does not integrate haze to arbitrary opaque objects located inside the atmosphere. Existing umbra/penumbra hooks remain attached to the surface and cloud shaders.

## Sources and preparation

Maps are [Solar System Scope / INOVE](https://www.solarsystemscope.com/textures/) adaptations of NASA imagery and elevation data, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Using the same registered map family keeps the coastlines, ocean mask and normal map aligned with the original Earth texture. Source URLs and credit are recorded in `public/textures/earth/sources.json`; cloud/night fallbacks are resampled from the source 8K maps. Imagery, seasons, clouds and city lights are reference illustrations, not reconstructions of conditions at the selected date.

Run `node scripts/fetch-earth-data.mjs` to download and prepare assets. Offline TIFF conversion and JPEG resampling use Windows System.Drawing. No images are fetched from external services at application runtime.

`node --import tsx scripts/check-earth-shaders.ts <path-to-glslang>` checks the Three.js-generated surface, normal-mapped surface, cloud and atmosphere variants with Khronos glslang. The compiler is a development diagnostic, not an application dependency. Its reserved `average` qualifier conflicts with a pre-existing Three.js helper; the script alpha-renames that helper only in compiler input. `scripts/preview-earth.ts` provides an offline CPU approximation for geometry/color/scattering review; it does not substitute for a live WebGL review.

Tests cover projected-size LOD and hysteresis, deterministic cloud phases, physical layer heights, atmosphere/foreground depth ordering, concurrent texture ownership, late loading, retained eclipse hooks, asset dimensions and image provenance. Candidate activation must preserve the user's views, time, playback and camera poses.
