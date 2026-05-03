import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { Plugin, ResolvedConfig, Rollup } from 'vite';

import {
  collectEntrypoints,
  collectFiles,
  generateManifest,
  transformFiles,
  type FileDescriptor,
  type GenerateContext
} from './helpers.js';
import { getCompilerHooks } from './hooks.js';

type OutputBundle = Rollup.OutputBundle;
type NormalizedOutputOptions = Rollup.NormalizedOutputOptions;
type PluginContext = Rollup.PluginContext;

export type { FileDescriptor, GenerateContext };
export { getCompilerHooks };
export { SyncWaterfallHook } from './hooks.js';
export type { ManifestPluginHooks, ManifestTap } from './hooks.js';

export type Manifest = Record<string, unknown>;

export interface InternalOptions {
  basePath: string;
  fileName: string;
  filter: ((file: FileDescriptor) => boolean) | null;
  generate:
    | ((
        seed: Record<string, unknown>,
        files: FileDescriptor[],
        entries: Record<string, string[]>,
        context: GenerateContext
      ) => Manifest)
    | undefined;
  map: ((file: FileDescriptor) => FileDescriptor) | null;
  publicPath: string | null;
  removeKeyHash: RegExp | false;
  seed: Record<string, unknown> | undefined;
  serialize: (manifest: Manifest) => string;
  sort: ((a: FileDescriptor, b: FileDescriptor) => number) | null;
  transformExtensions: RegExp;
  useEntryKeys: boolean;
  writeToFileEmit: boolean;
}

export type ManifestPluginOptions = Partial<InternalOptions>;

const defaults: InternalOptions = {
  basePath: '',
  fileName: 'manifest.json',
  filter: null,
  generate: undefined,
  map: null,
  publicPath: null,
  removeKeyHash: /([a-f0-9]{16,32}\.?)/gi,
  seed: undefined,
  serialize: (manifest) => JSON.stringify(manifest, null, 2),
  sort: null,
  transformExtensions: /^(gz|map)$/i,
  useEntryKeys: false,
  writeToFileEmit: false
};

const PLUGIN_NAME = 'vite-asset-manifest';

/**
 * Process-level set of manifest output paths produced by this plugin. When two
 * instances coexist, each instance's `generateBundle` sees the other's emitted
 * manifest as an asset in the bundle. We filter those sibling emissions out so
 * they don't leak into one another's manifest contents.
 */
const knownManifestAssetIds = new Set<string>();

const ensureTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value : `${value}/`;

const normalizePublicPath = (
  optionPublicPath: string | null,
  configBase: string
): string => {
  const resolved = optionPublicPath !== null ? optionPublicPath : configBase;
  if (resolved === 'auto' || resolved === '') {
    return '';
  }
  return resolved;
};

export type ManifestPlugin = Plugin;

export function ViteManifestPlugin(opts: ManifestPluginOptions = {}): ManifestPlugin {
  const options: InternalOptions = { ...defaults, ...opts };
  let resolvedConfig: ResolvedConfig | undefined;
  let resolvedManifestAssetId: string | undefined;

  const plugin: Plugin = {
    name: PLUGIN_NAME,
    apply: 'build',

    configResolved(config) {
      resolvedConfig = config;
      // Pre-register the manifest path so sibling instances filter our output
      // out of their bundles.
      const outDir = resolve(config.root ?? process.cwd(), config.build.outDir);
      const manifestFileName = isAbsolute(options.fileName)
        ? options.fileName
        : resolve(outDir, options.fileName);
      const id = relative(outDir, manifestFileName);
      if (!id.startsWith('..') && !isAbsolute(id)) {
        resolvedManifestAssetId = id;
        knownManifestAssetIds.add(id);
      }
    },

    generateBundle(
      this: PluginContext,
      _outputOptions: NormalizedOutputOptions,
      bundle: OutputBundle
    ) {
      if (!resolvedConfig) {
        throw new Error(`[${PLUGIN_NAME}] resolved config is not available`);
      }
      const config = resolvedConfig;
      const outDir = resolve(config.root ?? process.cwd(), config.build.outDir);
      const manifestFileName = isAbsolute(options.fileName)
        ? options.fileName
        : resolve(outDir, options.fileName);
      const manifestAssetId = resolvedManifestAssetId ?? relative(outDir, manifestFileName);
      const canEmitViaBundle =
        !manifestAssetId.startsWith('..') && !isAbsolute(manifestAssetId);

      const publicPath = normalizePublicPath(options.publicPath, config.base ?? '');
      const { basePath, removeKeyHash } = options;

      // Filter sibling-plugin manifest emissions so they don't get folded into
      // ours. (Our own emission happens later in this hook, so it isn't in the
      // bundle yet.)
      let files = collectFiles(bundle, options).filter(
        (f) => !knownManifestAssetIds.has(f.path)
      );

      files = files.map((file) => {
        const next: FileDescriptor = { ...file };
        if (basePath) {
          next.name = ensureTrailingSlash(basePath) + file.name;
        }
        if (publicPath) {
          next.path = ensureTrailingSlash(publicPath) + file.path;
        }
        if (removeKeyHash) {
          next.name = next.name.replace(removeKeyHash, '');
        }
        return next;
      });

      files = transformFiles(files, options);

      const entrypoints = collectEntrypoints(bundle);
      const context: GenerateContext = { bundle, config };

      let manifest = generateManifest(files, entrypoints, options, context);

      const hooks = getCompilerHooks(plugin);
      manifest = hooks.beforeEmit.call(manifest);

      const output = options.serialize(manifest);

      if (canEmitViaBundle) {
        this.emitFile({ type: 'asset', fileName: manifestAssetId, source: output });
      }

      if (!canEmitViaBundle || options.writeToFileEmit) {
        mkdirSync(dirname(manifestFileName), { recursive: true });
        writeFileSync(manifestFileName, output);
      }

      hooks.afterEmit.call(manifest);
    }
  };

  return plugin;
}

/** Default export so consumers can `import ManifestPlugin from 'vite-asset-manifest'`. */
export default ViteManifestPlugin;
