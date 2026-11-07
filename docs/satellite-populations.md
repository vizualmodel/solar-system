# Cached satellite populations

Scene → Satellites includes GEO, active LEO (apogee ≤2,000 km), Starlink, MEO navigation (GNSS perigee >2,000 km and apogee <35,786 km), and GPS filters. Counts describe this cache, not every object in space. Filters combine by union of NORAD IDs; Starlink and GPS are subsets. Layers default off in existing sessions and are saved per view.

Enable layers, then click a dot or search enabled satellites by name or NORAD ID to open the card. The card appears on the left so the settings panel cannot cover it. Click empty space or close the card to clear both the details and the selected orbit. The ordinary timeline speed control determines their apparent speed.

Three-pixel dots have a 12 CSS pixel picking radius. Click selects the nearest visible dot, highlights its one-revolution orbit and opens its card without moving the camera or time. Dragging does not select. Earth obscures dots and click targets. Close the card to clear selection. Dots and paths use physical Earth distances; use true body scale for an unobstructed comparison.

Near the OMM epoch, positions use satellite.js SGP4. Beyond ±3 days, bounded mean-element two-body orbits replace long extrapolation of atmospheric drag. Both the view and selected card label this as illustrative: historical launches, manoeuvres, deorbits and exact positions are not reconstructed. Altitude is geocentric radius minus the WGS84 equatorial radius; speed is inertial. Period and inclination come from cached mean elements. Constellation labels are name-based, with Other / unassigned for unknown objects.

Refresh explicitly with `node scripts/fetch-population-data.mjs`. It validates all groups before atomically replacing the accepted JSON, verifies write permission before downloading, and refuses refreshes of caches under two hours old. Never retry a provider rate refusal until its update. For recovery, an explicit `--cache-proxy` argument uses the published ReTLEctor CelesTrak cache; each source URL is recorded in the JSON. The initial cache uses this recovery path. The browser does no network refresh. Build and activate through companion after refresh.

The `satellites` companion settings accept `populationGroups` and nullable `populationSelection` (NORAD ID). Selecting requires an enabled group. Full observations include catalogue counts, enabled unique counts and selected-satellite details. Existing spacecraft controls remain independent.
