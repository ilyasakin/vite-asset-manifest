import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import type { InlineConfig, Plugin } from 'vite';
import { build } from 'vite';

import { ViteManifestPlugin, type ManifestPluginOptions } from '../../src/index.js';

export interface FixtureFiles {
  [relativePath: string]: string;
}

export interface RunOptions {
  files: FixtureFiles;
  /** Map of entry-name -> relative source path inside the workDir. */
  input: Record<string, string>;
  manifest?: ManifestPluginOptions;
  /** Vite-side `base`. Defaults to '' so manifest values are unprefixed unless a test opts in. */
  base?: string;
  /** Use hashed output names. Defaults to false for deterministic asserts. */
  hashed?: boolean;
  /** Override the [hash:N] length. Only honored when `hashed` is true. */
  hashLength?: number;
  /** Pass through `build.sourcemap`. */
  sourcemap?: boolean | 'inline' | 'hidden';
  /** Extra plugins to insert alongside the manifest plugin. */
  extraPlugins?: Plugin[];
  /** Override `build.outDir`. Defaults to "dist". */
  outDir?: string;
  /** Pre-built plugin instance (lets a test grab the same handle for `getCompilerHooks`). */
  plugin?: Plugin;
  /** Disable the entry/chunk/asset prefix; defaults to root-of-outDir output. */
  outputPrefix?: string;
  /** Enable Rollup `output.preserveModules` style runs by passing extra rollupOptions. */
  rollupOutputOverrides?: Record<string, unknown>;
  /**
   * When true, do not inject `publicPath: ''` into manifest options. Lets a test
   * exercise the plugin's default behavior (which falls back to Vite's `base`).
   */
  inheritPublicPath?: boolean;
  /** Pass through to `build.assetsInlineLimit`. Default 0 so assets are emitted, not inlined. */
  assetsInlineLimit?: number;
}

export interface RunResult {
  workDir: string;
  outDir: string;
  manifestPath: string;
}

const FALLBACK_LOG_LEVEL: InlineConfig['logLevel'] = 'silent';

export const createWorkDir = (): string =>
  mkdtempSync(join(tmpdir(), 'vite-asset-manifest-test-'));

export const removeWorkDir = (dir: string): void => {
  if (!dir) return;
  rmSync(dir, { recursive: true, force: true });
};

export const writeFixture = (workDir: string, relativePath: string, contents: string): void => {
  const full = join(workDir, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
};

const buildInputMap = (workDir: string, input: Record<string, string>): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [name, rel] of Object.entries(input)) {
    result[name] = isAbsolute(rel) ? rel : join(workDir, rel);
  }
  return result;
};

export const runBuild = async (workDir: string, opts: RunOptions): Promise<RunResult> => {
  for (const [path, content] of Object.entries(opts.files)) {
    writeFixture(workDir, path, content);
  }

  const hashSegment = opts.hashed ? `-[hash${opts.hashLength ? `:${opts.hashLength}` : ''}]` : '';
  const prefix = opts.outputPrefix ?? '';
  const outDir = opts.outDir ?? 'dist';

  const manifestOpts: ManifestPluginOptions = { ...(opts.manifest ?? {}) };
  if (!opts.inheritPublicPath && manifestOpts.publicPath === undefined) {
    manifestOpts.publicPath = '';
  }
  const plugin = opts.plugin ?? ViteManifestPlugin(manifestOpts);

  const config: InlineConfig = {
    root: workDir,
    logLevel: FALLBACK_LOG_LEVEL,
    base: opts.base ?? '',
    configFile: false,
    build: {
      outDir,
      emptyOutDir: true,
      write: true,
      sourcemap: opts.sourcemap ?? false,
      cssCodeSplit: true,
      assetsInlineLimit: opts.assetsInlineLimit ?? 0,
      rollupOptions: {
        input: buildInputMap(workDir, opts.input),
        output: {
          entryFileNames: `${prefix}[name]${hashSegment}.js`,
          chunkFileNames: `${prefix}[name]${hashSegment}.js`,
          assetFileNames: `${prefix}[name]${hashSegment}[extname]`,
          ...(opts.rollupOutputOverrides ?? {})
        }
      }
    },
    plugins: [plugin, ...(opts.extraPlugins ?? [])]
  };

  await build(config);

  const manifestFileName = opts.manifest?.fileName ?? 'manifest.json';
  const absoluteOutDir = join(workDir, outDir);
  const manifestPath = isAbsolute(manifestFileName)
    ? manifestFileName
    : join(absoluteOutDir, manifestFileName);

  return { workDir, outDir: absoluteOutDir, manifestPath };
};

export const readManifest = <T = Record<string, unknown>>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T;

export const readText = (path: string): string => readFileSync(path, 'utf8');
