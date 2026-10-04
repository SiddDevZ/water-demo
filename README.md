# water-demo

Komorebi — A blue koi pond.

An overhead Three.js water study inspired by the supplied blue koi-pond reference: deep blue water, pale turquoise shelves, warm sand, mossy stones, lime-green banks and two corner cherry canopies. A minimal six-slot pixel HUD keeps the pond central. Local Saltwind Island supplied early optical inspiration; the current interaction solver and caustic system are new implementations.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5190. Build with `npm run build`.

## Deploy to Vercel

Import this repository with the repository root as the project root. `vercel.json` configures a clean dependency install including Vite, the production build, and the `dist` output directory. The project uses Node.js 22. Dependencies install from npm; no sibling workspace is required.

## Play

- **1 — Stir:** drag to push a continuous wake through the water.
- **2 — Toss stone:** one click throws one stone. It impacts once, splashes and sinks; holding or dragging does not throw more stones.
- **3 — Float a leaf:** click to set a leaf on the surface.
- **4 — Rain:** start a shower; switch tools to stop.
- **5 — Feed koi:** scatter food and watch the fish gather.
- **6 — Paper boat:** launch a buoyant paper boat.
- **Desktop:** right-drag to orbit, scroll to zoom; use keys 1–6 or click a tool slot.
- **Touch:** tap a slot, then tap or drag the pond to interact. Use two fingers to orbit and zoom; desktop keyboard shortcuts are optional.
- **H:** hide or restore the interface.

The upper-right gear contains 22 live settings for water motion, optics, sunlight, stone throws, and how boats, koi, leaves and petals respond. Choose Natural, Glass, Cinematic or Playful presets; changes save locally. Settings reset and scene reset are separate. The panel also includes ambience, fullscreen and recording controls. Recording captures the canvas without the interface or audio, requesting up to 60 fps. Stop to download, or let the 30-second limit finish. Chromium normally produces WebM; actual capture rate depends on hardware.

## Surface simulation

Stones, dragging and rain act on one shared 320 × 256 conservative surface field. Height lives at cell centers and velocities at cell faces. Shared face fluxes preserve displaced water volume; each impact starts a balanced depression and surrounding displacement, followed by a short damped cavity rebound. The resulting crests travel through the field; the localized source expires after 0.85 seconds. There are no scheduled expanding impact rings. Pointer strokes deposit directional momentum along their path instead of stamping circles per mouse event.

The solver uses a fixed 120 Hz clock with CFL-controlled subdivisions. A narrowband finite-depth approximation uses effective depth `tanh(kD) / k`, with `k = 2π / 1.8 m`, to limit deep-water wave speed. This models one interaction wavelength band; it is **not full spectral dispersion**. Damping reduces energy over time. Dry cells and approximate circular rock masks impose impermeable boundaries, while depth controls propagation speed.

Small analytic wind waves remain as ambient surface detail. They fade toward shore. Rendering, floating-object height queries and caustics sample the same combined surface. `setTerrain(bankHeight)` supplies the irregular bed and dry-land mask; terrain and rock obstacles remain independent.

## Water optics

Depth absorption, restrained blue scattering and physical Fresnel make shallow bottom detail visible while stronger reflections appear at grazing angles. Refraction uses surface-normal deviations and the actual optical distance to the bottom or near-surface fish.

Planar reflection captures use an oblique clipping plane to exclude submerged geometry. Projective sampling bends the reflected ray using the current surface normal. Optical captures refresh up to 60 Hz, with camera movement, resize and reset forcing refresh. The pointer marker is excluded from captures.

Caustics come from refracted rays projected through the current surface into a photon-density map. Their spatial concentration supplies subtle submerged bed and rock lighting. They are no longer independently timed white procedural patterns. Shadow masks and submerged-depth limits prevent lighting dry ground or shaded regions incorrectly.

This remains an interactive surface-wave approximation, **not a full Navier–Stokes or volumetric fluid simulation**. There is no erosion, breaking-wave volume, arbitrary overtopping or full fluid–body coupling. Reflection and refraction use screen/planar captures, and caustic ray splatting is a rendering approximation. The earlier feeder stream is hidden in this reference composition.

## Spring life

The default view looks down into an irregular blue pond with warm sandy shallows. Two cherry trees frame opposite corners; fine grass, ferns, cream/pink daisies and mossy rocks surround the open water. The opening scene contains six koi, one paper boat, four floating leaves and 44 pink petals. These counts describe startup; tools add objects and reset clears user-managed objects. There are no courtyard walls or paving in the active scene.

Koi bend their bodies and steer toward food or away from stone impacts. Shoreline clearance prevents them crossing dry shelves. Paper boats sample surface heights for heave, pitch and roll; hull-footprint checks keep them off shallow banks. Floating leaves and cherry petals follow the surface. These are lightweight interaction models.

## Assets

Scanned trees, ferns, rocks and textures come from existing local Willowmere assets. Provenance files remain in `public/assets`. Pixelify Sans is local, with its SIL Open Font License in `public/assets/ui/fonts`. Terrain, koi patterns, lilies, paper boats and splash effects use code-generated geometry or textures. No external asset API is required at runtime.

## Verification

```sh
node test-water-solver.mjs
```

The suite covers conservation, propagation, depth behavior, damping, obstacles, frame-rate consistency, optical state restoration and live mirror captures. Stone tests cover one impact per throw, target accuracy, sinking, reset and count limits.

With the development server running:

```sh
node tests/smoke.cjs
node tests/optics.cjs
```

The smoke test uses the workspace Playwright installation and installed Chrome. It checks render errors, actual field advancement and reset, continuous dragging, one stone per pointer press, feeding, boats, controls, recording and mobile layout. The optics probe reads back the photon-density target to verify a flat surface has near-uniform light and an impact changes that distribution. Desktop browsers are the primary target. Mobile controls and responsive layout are supported, but dense planting, live optical captures, caustics and recording are GPU intensive; smooth desktop frame rates are not guaranteed on phones. No universal frame-rate claim is made.

## Current preview

The latest reference-scene captures are in `captures/reference-pond-*.png`. `captures/reference-pond-demo.mp4` shows one stone toss, its wave train, a continuous drag wake and koi feeding. Reproduce these with `node tests/capture-reference.cjs` while the dev server is running.
