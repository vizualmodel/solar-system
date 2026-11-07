# Object information in View settings

Every planet, moon and spacecraft row has an information icon. It opens a native modal dialog with a locally bundled NASA image, a short introduction, a highlighted fact, a key-facts table and links to Wikipedia and the NASA source. The dialog traps keyboard focus, closes with Escape or its close button, and returns focus to the triggering control. The underlying simulation continues unchanged.

Edit curated text, categories, orbital periods, facts and reference URLs in `src/data/object-info.ts`. Natural-body radii and parent names come from the existing catalog; spacecraft tables deliberately omit the renderer's synthetic bounding radius. Facts are rounded reference values, not current telemetry. Satellite dialogs also show the bundled orbital snapshot date and the accuracy mode at the selected simulation date.

`src/data/object-images.json` records image provenance. Local image files live in `public/images/objects/`. Run `node scripts/fetch-object-images.mjs` to refresh them from the curated NASA pages; review the resulting imagery and credit links before activation. Images are downloaded at development time, never when a user opens a dialog. The HTML layout and responsive styles live in `src/components/ObjectInfoDialog.svelte`; content is rendered as text, without raw HTML injection.

All settings sections start collapsed. Expansions are retained during the running session when switching tabs or reopening the panel. A fresh application load starts collapsed again.

The satellite section has one magnification slider. Moving it sets both satellite magnifications for the selected view, leaving physical orbits unchanged. Old sessions and scenarios with different per-satellite values show “Mixed” until the slider is moved; merely opening settings preserves those saved values. Spacecraft setup buttons have been removed in favour of Scenarios, while camera and information icons remain available.
