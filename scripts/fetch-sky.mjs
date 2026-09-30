import { mkdir, writeFile } from 'node:fs/promises';

// J2000 equatorial maps. Keep the already aligned constellation figures.
const assets = [
  {name:'starmap_2020_8k.exr',url:'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_8k.exr'},
  {name:'constellation_figures.jpg',url:'https://svs.gsfc.nasa.gov/vis/a000000/a003800/a003895/constellation_figures.jpg'},
];
await mkdir('public/textures/sky', { recursive: true });
for (const {name,url} of assets) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (name.endsWith('.exr') ? bytes.readUInt32LE(0)!==20000630 : bytes[0]!==0xff||bytes[1]!==0xd8) throw new Error(`${name}: invalid image signature`);
  await writeFile(`public/textures/sky/${name}`, bytes);
  console.log(`${name}: ${bytes.length} bytes`);
}
await writeFile('public/textures/sky/sources.json', JSON.stringify({
  source: 'https://svs.gsfc.nasa.gov/4851/',
  constellationSource: 'https://svs.gsfc.nasa.gov/3895/',
  credit: 'NASA/Goddard Space Flight Center Scientific Visualization Studio',
  gaiaCredit: 'Gaia DR2: ESA/Gaia/DPAC',
  figures: 'Based on figures developed for the IAU by Alan MacRobert, Sky and Telescope (Roger Sinnott and Rick Fienberg). Figures are conventional, not official constellation boundaries.',
  coordinates: 'J2000 equatorial, plate carree, RA 0h at image center and increasing leftward',
  assets,
}, null, 2));
