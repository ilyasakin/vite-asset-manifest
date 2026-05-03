import { defineConfig } from 'vite';
import {
  ViteManifestPlugin,
  type FileDescriptor,
  type ManifestPluginOptions
} from 'vite-asset-manifest';

// In a real deployment this would come from your build environment, e.g.
// `process.env.PUBLIC_URL`. Falling back to "/" keeps the example runnable.
const publicPath = process.env.PUBLIC_URL ?? '/';

const fontExtensions = ['.woff', '.woff2', '.ttf', '.eot', '.otf'];
const imageExtensions = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'
];

const relativeUnderStatic = (filePath: string): string => {
  const idx = filePath.indexOf('static/');
  if (idx >= 0) return filePath.slice(idx);
  const slash = filePath.lastIndexOf('/');
  return slash >= 0 ? filePath.slice(slash + 1) : filePath;
};

const hasExtension = (file: FileDescriptor, exts: readonly string[]): boolean => {
  const lower = file.path.toLowerCase();
  return exts.some((ext) => lower.endsWith(ext));
};

interface EntryFiles {
  css: string[];
  js: string[];
  fonts: string[];
}

const manifestOptions: ManifestPluginOptions = {
  fileName: 'asset-manifest.json',
  publicPath,
  seed: {
    publicPath,
    builtAt: Date.now()
  },
  generate: (seed, files, entrypoints) => {
    const fonts = files
      .filter((f) => hasExtension(f, fontExtensions))
      .map((f) => relativeUnderStatic(f.path));

    const images = files
      .filter((f) => f.path.toLowerCase().includes('static/'))
      .filter((f) => hasExtension(f, imageExtensions))
      .map((f) => relativeUnderStatic(f.path));

    const entryFiles: Record<string, EntryFiles> = {};

    for (const [entry, chunks] of Object.entries(entrypoints)) {
      entryFiles[entry] = {
        css: chunks.filter((x) => x.endsWith('.css')),
        js: chunks.filter((x) => x.endsWith('.js') && !x.includes('hot-update')),
        fonts
      };
    }

    return { ...seed, entryFiles, images };
  }
};

export default defineConfig({
  plugins: [ViteManifestPlugin(manifestOptions)],
  build: {
    // Outputs assets under dist/static/ so path filters in generate() (which
    // look for "static/") line up with the on-disk layout.
    assetsDir: 'static',
    sourcemap: true,
    // Force fonts and SVGs to disk instead of being inlined as data: URLs.
    assetsInlineLimit: 0
  }
});
