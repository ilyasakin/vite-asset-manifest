# vite-asset-manifest

A Vite 8 plugin that emits an asset manifest. This is a port of
[`rspack-manifest-plugin`](https://github.com/rstackjs/rspack-manifest-plugin)
(itself a fork of
[`webpack-manifest-plugin`](https://github.com/shellscape/webpack-manifest-plugin))
to Vite's Rollup-based build pipeline. The option surface, defaults, and
manifest shape are intentionally kept 1:1 with the upstream plugins so
existing manifest consumers (Rails / Phoenix asset pipelines, server-side
template helpers, etc.) keep working when migrating from Webpack/Rspack to
Vite.

## Install

```bash
npm install -D vite-asset-manifest
```

Peer dependency: `vite ^8.0.0`.

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { ViteManifestPlugin } from 'vite-asset-manifest';

export default defineConfig({
  plugins: [
    ViteManifestPlugin({
      // options...
    })
  ]
});
```

With the default options the build emits `manifest.json` into the configured
`build.outDir`:

```json
{
  "main.js": "/assets/main-DEhJK2L7.js",
  "main.css": "/assets/main-W1erjkBN.css",
  "vendor.js": "/assets/vendor-aB3xQ9pZ.js"
}
```

## Options

All options are optional.

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `basePath` | `string` | `''` | Prefix prepended to every manifest **key**. Useful for namespacing the manifest under an output path. |
| `fileName` | `string` | `'manifest.json'` | Output file name. May be absolute, in which case the manifest is written via `fs` rather than emitted into the bundle. |
| `filter` | `(file: FileDescriptor) => boolean` | `null` | Drop files where the predicate returns `false`. |
| `generate` | `(seed, files, entries, ctx) => Manifest` | `undefined` | Build the manifest object yourself. Receives the seed, the post-`filter`/`map`/`sort` files, an `entryName -> [outputFile, ...]` map, and a `{ bundle, config }` context object. |
| `map` | `(file: FileDescriptor) => FileDescriptor` | `null` | Transform each file descriptor before it is folded into the manifest. |
| `publicPath` | `string \| null` | `null` (uses `config.base`) | Prefix prepended to every manifest **value**. Pass `''` to disable. The string `'auto'` is treated as `''` for parity with rspack. |
| `removeKeyHash` | `RegExp \| false` | `/([a-f0-9]{16,32}\.?)/gi` | Strip hashes out of manifest keys. The default targets the long md5 hashes used by Webpack/Rspack; for Vite's shorter base64-style hashes pass a regex such as `/-[\w-]{8}\./` or `false` to disable. |
| `seed` | `Record<string, unknown>` | `{}` | Initial object the manifest is built on top of. Useful for merging static metadata or combining manifests across multiple builds. |
| `serialize` | `(manifest) => string` | `JSON.stringify(m, null, 2)` | Serialize the final manifest. Override to emit YAML, TOML, etc. |
| `sort` | `(a, b) => number` | `null` | Sort comparator applied to file descriptors. |
| `transformExtensions` | `RegExp` | `/^(gz\|map)$/i` | Extensions treated as compound (e.g. `.js.map`, `.js.gz`) when computing manifest keys. |
| `useEntryKeys` | `boolean` | `false` | Use chunk names verbatim as keys (`main` instead of `main.js`). `.map` files always keep the extension. |
| `writeToFileEmit` | `boolean` | `false` | In addition to emitting through the bundle, write the manifest to disk via `fs.writeFileSync`. |

> **Note**: `useLegacyEmit` and `assetHookStage` from the upstream plugin are
> Webpack/Rspack-specific (they target the `processAssets` pipeline) and have
> no equivalent in Rollup; they are not exposed here.

## File descriptor

```ts
interface FileDescriptor {
  chunk?: Rollup.OutputChunk;     // present when isChunk
  asset?: Rollup.OutputAsset;     // present when isAsset
  isAsset: boolean;
  isChunk: boolean;
  isInitial: boolean;             // chunk.isEntry && !chunk.isDynamicEntry
  isModuleAsset: boolean;         // copy-style asset (e.g. import url from './x.png')
  name: string;                   // manifest key (after basePath / removeKeyHash)
  path: string;                   // manifest value (after publicPath)
  integrity?: string;             // populated if an upstream plugin attaches `integrity`
}
```

## Hooks

The plugin exposes two synchronous waterfall hooks per instance, mirroring
`getCompilerHooks` on the Webpack/Rspack side:

```ts
import { ViteManifestPlugin, getCompilerHooks } from 'vite-asset-manifest';

const manifest = ViteManifestPlugin();
const { beforeEmit, afterEmit } = getCompilerHooks(manifest);

beforeEmit.tap('inject-meta', (m) => ({ ...m, builtAt: Date.now() }));
afterEmit.tap('log', (m) => {
  console.log('wrote manifest with', Object.keys(m).length, 'entries');
  return m;
});

export default { plugins: [manifest, /* ...other plugins */] };
```

`beforeEmit` runs after the manifest object is computed but before it is
serialized and written. Each tap may return a replacement manifest, which
flows into the next tap. `afterEmit` runs after the manifest has been
written; its return value is discarded.

## Behavioural differences from the upstream plugin

These differences come from the underlying bundler, not from a change in
intent. The manifest shape is identical for the same inputs in the common
case.

1. **Chunk vs. asset boundaries.** Webpack lists CSS extracted from a JS
   entry inside `chunk.files`, so both `main.js` and `main.css` come from a
   single chunk. Rollup emits the CSS as a separate `OutputAsset`. We detect
   the "derived asset" case (logical name set, extension differs from the
   originating source file) and produce `chunk-name.ext` keys to match
   webpack-flavored manifests.
2. **`publicPath` default.** When `publicPath` is not set, this plugin uses
   Vite's `config.base` (default `'/'`). The string `'auto'` is treated as
   the empty string for parity with rspack-manifest-plugin's runtime
   publicPath mode.
3. **`removeKeyHash` default.** The default regex matches Webpack/Rspack's
   md5 hash format. Vite's default `[hash:8]` (e.g. `main-DEhJK2L7.js`)
   isn't matched by it, so manifest keys retain hashes unless you pass a
   suitable regex (or `false`).
4. **Module assets.** A module asset is detected when the asset's
   `originalFileName` shares an extension with its emitted `fileName`, e.g.
   `import url from './logo.png'` -> `assets/logo-XXXX.png` keyed under
   `assets/logo.png`.
5. **No dev-server hook.** Vite's dev server doesn't run `generateBundle`,
   so the plugin only has effect during `vite build`. The `writeToFileEmit`
   option still applies during build (useful for absolute `fileName` paths
   that point outside `outDir`).

## License

MIT. See [LICENSE](./LICENSE) for attribution to the upstream
`webpack-manifest-plugin` and `rspack-manifest-plugin` authors.
