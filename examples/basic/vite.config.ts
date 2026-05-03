import { defineConfig } from 'vite';
import { ViteManifestPlugin, getCompilerHooks } from 'vite-asset-manifest';

// Construct the plugin once so we can attach hooks to this exact instance.
const manifest = ViteManifestPlugin({
  // Ship plain manifest values without a publicPath prefix. Drop this option
  // (or pass a string) to prepend a CDN / base path to every value.
  publicPath: '',
  // Vite's default hash format is short and base64-style; the plugin's default
  // `removeKeyHash` regex targets webpack-style md5 hashes and won't match it.
  // Disable it so the manifest keys read cleanly here.
  removeKeyHash: false,
  // Static metadata merged into every manifest produced by this build.
  seed: { generatedAt: new Date().toISOString() }
});

// Demonstrate the per-instance hook API. `beforeEmit` runs after the manifest
// is computed but before it is serialized; `afterEmit` runs once it has been
// written.
getCompilerHooks(manifest).beforeEmit.tap('basic-example', (m) => ({
  ...m,
  builtBy: 'examples/basic'
}));

export default defineConfig({
  plugins: [manifest],
  build: {
    sourcemap: true,
    // Force assets to disk so the SVG shows up in the manifest instead of
    // being inlined as a data: URL.
    assetsInlineLimit: 0
  }
});
