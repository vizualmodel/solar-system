# Ground observer scenery

Earth surface cameras show an illustrative rural observing site by default. The per-view **Display → Ground observer → Local landscape** switch, or `scene` settings `{ "localLandscape": false }`, hides it. Existing version-1 sessions remain valid; a missing switch means enabled in surface mode. Orbital views never create the landscape.

`local-landscape.ts` owns deterministic procedural terrain, a small gravel pad, instanced broadleaf trees and gabled houses. There are no downloaded models or textures. The site is illustrative at every latitude and longitude, rather than geospatial terrain or a reconstruction of Oviedo.

The telescope's geographic position and lens remain unchanged. A right-handed east/up/south frame follows the existing Earth orientation, and a separate local camera at the origin inherits the astronomical viewing direction and field of view. The ground sits 1.7 metres below the telescope, regardless of its configured elevation above sea level. Terrain extends 26 km with approximate spherical curvature. The separate metre-scale pass clears the astronomical depth buffer and draws only foreground geometry over the completed sky, including the existing atmosphere. Local haze is distance-dependent, so nearby scenery does not receive a whole sky column of scattering.

Sun direction, warm low-Sun lighting and twilight ambient light are recomputed from simulation time. Direct light follows the uncovered apparent solar-disc area; ambient light and haze also dim through an eclipse. This remains an artistic approximation: no real weather, refraction, terrain survey or terrain shadow maps. The western horizon uses distant trees to leave the main eclipse direction open. Telescope aiming and optical zoom retain their existing behaviour.

Geometry is generated lazily per surface view. Shared instance geometry keeps draw calls low; leaving surface mode, disabling scenery or closing the view releases all owned resources. The scenery never appears in space views or changes orbital calculations.
