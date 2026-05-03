# basic-example

A minimal Vite app that exercises every interesting code path in
`vite-asset-manifest`:

- A static CSS import → `style.css` extracted as a sibling asset
- A static SVG import → keyed by source filename (module-asset path)
- A dynamic `import()` of a sibling module → emitted as a non-initial chunk
- An external sourcemap → `.map` asset alongside the chunk
- A pre-seeded entry plus a `beforeEmit` hook that injects extra metadata

The example consumes the plugin via `workspace:*` so it always builds against
the in-repo source.

## Run

```bash
# from the repo root
pnpm install
pnpm -r build      # builds the plugin first, then the example
```

Then peek at `examples/basic/dist/manifest.json` — it should look something
like:

```json
{
  "generatedAt": "2026-05-03T14:36:19.335Z",
  "index.js": "assets/index-BsAUy_39.js",
  "lazy.js": "assets/lazy--WCnSMkS.js",
  "assets/index-BsAUy_39.js.map": "assets/index-BsAUy_39.js.map",
  "assets/lazy--WCnSMkS.js.map": "assets/lazy--WCnSMkS.js.map",
  "index.css": "assets/index-DvAo9EkY.css",
  "assets/logo.svg": "assets/logo-DFyRKTSp.svg",
  "builtBy": "examples/basic"
}
```

What to notice:

- `index.js` / `lazy.js` — chunk keys use the chunk name plus extension. The
  initial chunk is named `index` because Vite derives entry names from
  `index.html`; the dynamic chunk inherits its name from `lazy.ts`.
- `index.css` — the CSS imported from `main.ts` shows up under the entry's
  logical name with the `.css` extension. This is the "derived asset"
  case that the plugin handles specially to match webpack-flavored manifests.
- `assets/logo.svg` — keyed by the source filename, with the value pointing
  at the hashed output (a true module asset).
- `assets/<chunk>.js.map` — sourcemaps are emitted by Vite as anonymous
  assets, so the plugin keys them by their output filename (the value and
  key are identical).
- `generatedAt` / `builtBy` — the seed entry survives into the final
  manifest, and `beforeEmit` was free to add another property after the file
  list was assembled.

To preview the built app:

```bash
pnpm --filter basic-example preview
```
