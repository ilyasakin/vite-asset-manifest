# basic-example

A Vite app showing how to drive `vite-asset-manifest` with a custom
`generate()` to produce an asset manifest grouped by entry point and asset
kind. The plugin keeps API parity with `rspack-manifest-plugin`, so the
same option keys port directly between bundlers.

## What it exercises

- `fileName: 'asset-manifest.json'` — non-default manifest filename
- `publicPath` — read from `process.env.PUBLIC_URL`, defaulting to `/`
- `seed` — static metadata (`publicPath`, `builtAt`) merged into every build
- `generate(seed, files, entrypoints)` — fully replaces the manifest shape:
  - extracts every font output (`.woff` / `.woff2` / `.ttf` / `.eot` /
    `.otf`)
  - extracts every image under `static/` (`.png` / `.jpg` / `.svg` / ...)
  - per entry, builds a `{ css, js, fonts }` block from the chunk list
- `build.assetsDir: 'static'` — keeps output paths aligned with the path
  filters in `generate()`

## Run

```bash
# from the repo root
pnpm install
pnpm -r build      # builds the plugin first, then the example
```

Then peek at `examples/basic/dist/asset-manifest.json`. Expected shape:

```json
{
  "publicPath": "/",
  "builtAt": 1777822018385,
  "entryFiles": {
    "index": {
      "css": ["static/index-XXXXXXXX.css"],
      "js": ["static/index-XXXXXXXX.js"],
      "fonts": ["static/placeholder-XXXXXXXX.woff2"]
    }
  },
  "images": ["static/logo-XXXXXXXX.svg"]
}
```

## Notes / fixtures

- `src/fonts/placeholder.woff2` is a text placeholder, not a real font — it
  exists so the asset pipeline emits a `.woff2` the manifest's `fonts`
  array can pick up.
- To preview the built app: `pnpm --filter basic-example preview`.
