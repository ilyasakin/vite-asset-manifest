import { basename, dirname, join } from 'node:path';
import type { ResolvedConfig, Rollup } from 'vite';

import type { InternalOptions, Manifest } from './index.js';

type OutputAsset = Rollup.OutputAsset;
type OutputBundle = Rollup.OutputBundle;
type OutputChunk = Rollup.OutputChunk;

export interface FileDescriptor {
  chunk?: OutputChunk;
  asset?: OutputAsset;
  isAsset: boolean;
  isChunk: boolean;
  isInitial: boolean;
  isModuleAsset: boolean;
  name: string;
  path: string;
  /**
   * Subresource Integrity (SRI) hash. Only populated when an upstream plugin
   * attaches an `integrity` property to the bundle entry.
   */
  integrity?: string;
}

export interface GenerateContext {
  bundle: OutputBundle;
  config: ResolvedConfig;
}

export const generateManifest = (
  files: FileDescriptor[],
  entrypoints: Record<string, string[]>,
  options: InternalOptions,
  context: GenerateContext
): Manifest => {
  const seed = options.seed ?? {};
  if (options.generate) {
    return options.generate(seed, files, entrypoints, context);
  }
  return files.reduce<Manifest>(
    (manifest, file) => Object.assign(manifest, { [file.name]: file.path }),
    seed
  );
};

const getFileType = (fileName: string, transformExtensions: RegExp): string => {
  const stripped = fileName.replace(/\?.*/, '');
  const parts = stripped.split('.');
  const ext = parts.pop() ?? '';
  if (transformExtensions.test(ext)) {
    const prev = parts.pop() ?? '';
    return `${prev}.${ext}`;
  }
  return ext;
};

const getOriginalName = (asset: OutputAsset): string | undefined => {
  const originals = (asset as { originalFileNames?: string[] }).originalFileNames;
  if (originals && originals.length > 0) {
    return originals[0];
  }
  const single = (asset as { originalFileName?: string | null }).originalFileName;
  return single ?? undefined;
};

const getIntegrity = (entry: OutputChunk | OutputAsset): string | undefined => {
  const value = (entry as { integrity?: unknown }).integrity;
  return typeof value === 'string' ? value : undefined;
};

export const collectFiles = (
  bundle: OutputBundle,
  options: InternalOptions
): FileDescriptor[] => {
  const files: FileDescriptor[] = [];

  for (const entry of Object.values(bundle)) {
    if (entry.type === 'chunk') {
      files.push(buildChunkDescriptor(entry, options));
    }
  }

  for (const entry of Object.values(bundle)) {
    if (entry.type === 'asset') {
      const descriptor = buildAssetDescriptor(entry, options);
      if (descriptor) {
        files.push(descriptor);
      }
    }
  }

  return files;
};

const buildChunkDescriptor = (
  chunk: OutputChunk,
  options: InternalOptions
): FileDescriptor => {
  const path = chunk.fileName;
  const isInitial = chunk.isEntry && !chunk.isDynamicEntry;
  const chunkName = chunk.name || null;

  let name: string;
  if (chunkName) {
    if (options.useEntryKeys && !path.endsWith('.map')) {
      name = chunkName;
    } else {
      name = `${chunkName}.${getFileType(path, options.transformExtensions)}`;
    }
  } else {
    name = path;
  }

  const descriptor: FileDescriptor = {
    chunk,
    isAsset: false,
    isChunk: true,
    isInitial,
    isModuleAsset: false,
    name,
    path
  };

  const integrity = getIntegrity(chunk);
  if (integrity) {
    descriptor.integrity = integrity;
  }

  return descriptor;
};

const extensionOf = (file: string): string => {
  const stripped = file.replace(/\?.*/, '');
  const idx = stripped.lastIndexOf('.');
  return idx >= 0 ? stripped.slice(idx + 1).toLowerCase() : '';
};

const buildAssetDescriptor = (
  asset: OutputAsset,
  options: InternalOptions
): FileDescriptor | null => {
  const path = asset.fileName;
  const original = getOriginalName(asset);
  const pathExt = extensionOf(path);
  const originalExt = original ? extensionOf(original) : '';
  const isTrueModuleAsset = !!original && originalExt === pathExt;

  let name: string;
  let isModuleAsset = false;

  if (isTrueModuleAsset) {
    // Asset emitted as a copy of a source file (e.g. `import logoUrl from
    // './logo.png'`). Mirror webpack/rspack behaviour and key on the
    // originating file path.
    name = join(dirname(path), basename(original!));
    isModuleAsset = true;
  } else if (asset.name && asset.name !== path && !asset.name.includes('.')) {
    // Derived side-effect asset whose logical `name` is an entry-style
    // identifier (e.g. CSS extracted from a JS chunk: name="withCss",
    // fileName="assets/withCss-DEhJ.css"). Use chunk-style naming so the
    // manifest reads like "withCss.css".
    if (options.useEntryKeys && !path.endsWith('.map')) {
      name = asset.name;
    } else {
      name = `${asset.name}.${getFileType(path, options.transformExtensions)}`;
    }
  } else if (asset.name && asset.name !== path) {
    name = asset.name;
  } else {
    name = path;
  }

  const descriptor: FileDescriptor = {
    asset,
    isAsset: true,
    isChunk: false,
    isInitial: false,
    isModuleAsset,
    name,
    path
  };

  const integrity = getIntegrity(asset);
  if (integrity) {
    descriptor.integrity = integrity;
  }

  return descriptor;
};

export const collectEntrypoints = (
  bundle: OutputBundle
): Record<string, string[]> => {
  const entries: Record<string, string[]> = {};
  for (const entry of Object.values(bundle)) {
    if (entry.type === 'chunk' && entry.isEntry && !entry.isDynamicEntry) {
      const name = entry.name || entry.fileName;
      const files: string[] = [entry.fileName];
      const meta = (entry as { viteMetadata?: { importedCss?: Set<string>; importedAssets?: Set<string> } })
        .viteMetadata;
      if (meta?.importedCss) {
        for (const css of meta.importedCss) {
          files.push(css);
        }
      }
      if (meta?.importedAssets) {
        for (const asset of meta.importedAssets) {
          files.push(asset);
        }
      }
      entries[name] = files;
    }
  }
  return entries;
};

const standardizeFilePaths = (file: FileDescriptor): FileDescriptor => ({
  ...file,
  name: file.name.replace(/\\/g, '/'),
  path: file.path.replace(/\\/g, '/')
});

export const transformFiles = (
  input: FileDescriptor[],
  options: InternalOptions
): FileDescriptor[] => {
  let files = input;
  if (options.filter) {
    files = files.filter(options.filter);
  }
  if (options.map) {
    files = files.map(options.map);
  }
  if (options.sort) {
    files = [...files].sort(options.sort);
  }
  return files.map(standardizeFilePaths);
};
