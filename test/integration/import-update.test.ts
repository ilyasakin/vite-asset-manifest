import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { build, type Rollup } from 'vite';

import { ViteManifestPlugin } from '../../src/index.js';
import {
  createWorkDir,
  readManifest,
  removeWorkDir,
  writeFixture
} from '../_helpers/build.js';

let workDir = '';

beforeEach(() => {
  workDir = createWorkDir();
});

afterEach(() => {
  removeWorkDir(workDir);
});

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const waitUntil = async (
  predicate: () => boolean,
  timeoutMs = 15_000,
  intervalMs = 50
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(intervalMs);
  }
  throw new Error(`waitUntil: predicate never satisfied within ${timeoutMs}ms`);
};

const waitForNextEnd = (watcher: Rollup.RollupWatcher, timeoutMs = 15_000) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      watcher.off('event', onEvent);
      reject(new Error(`waitForNextEnd timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    const onEvent = (event: { code: string; error?: Error }) => {
      if (event.code === 'ERROR') {
        clearTimeout(timer);
        watcher.off('event', onEvent);
        reject(event.error ?? new Error('rollup watcher ERROR'));
        return;
      }
      if (event.code === 'END') {
        clearTimeout(timer);
        watcher.off('event', onEvent);
        resolve();
      }
    };
    watcher.on('event', onEvent);
  });

const startWatcher = async (root: string): Promise<Rollup.RollupWatcher> => {
  const watcher = await build({
    root,
    logLevel: 'silent',
    configFile: false,
    base: '',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      write: true,
      watch: { clearScreen: false },
      rollupOptions: {
        input: { main: join(root, 'src/main.js') },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name][extname]'
        }
      }
    },
    plugins: [ViteManifestPlugin({ publicPath: '' })]
  });
  return watcher as Rollup.RollupWatcher;
};

describe('import set updates between watch builds', () => {
  it('drops a chunk from the manifest when the corresponding dynamic import is removed', async () => {
    writeFixture(workDir, 'src/chunk-one.js', "export const one = 'one';\n");
    writeFixture(workDir, 'src/chunk-two.js', "export const two = 'two';\n");
    writeFixture(
      workDir,
      'src/main.js',
      "(async () => { const a = await import('./chunk-one.js'); const b = await import('./chunk-two.js'); console.log(a, b); })();\n"
    );

    const watcher = await startWatcher(workDir);
    const manifestPath = join(workDir, 'dist/manifest.json');

    try {
      await waitUntil(() => existsSync(manifestPath));
      const first = readManifest<Record<string, string>>(manifestPath);
      expect(first['main.js']).toBeDefined();
      const firstKeys = Object.keys(first);
      expect(firstKeys.some((k) => k.includes('chunk-one') || k === 'chunk-one.js')).toBe(true);
      expect(firstKeys.some((k) => k.includes('chunk-two') || k === 'chunk-two.js')).toBe(true);

      const nextEnd = waitForNextEnd(watcher);
      writeFileSync(
        join(workDir, 'src/main.js'),
        "(async () => { const a = await import('./chunk-one.js'); console.log(a); })();\n"
      );
      await nextEnd;

      // Rollup writes asset files after END fires; poll until the manifest
      // reflects the dropped chunk-two entry.
      await waitUntil(() => {
        try {
          const m = readManifest<Record<string, string>>(manifestPath);
          return !Object.keys(m).some((k) => k.includes('chunk-two'));
        } catch {
          return false;
        }
      });

      const second = readManifest<Record<string, string>>(manifestPath);
      const secondKeys = Object.keys(second);
      expect(secondKeys.some((k) => k.includes('chunk-one') || k === 'chunk-one.js')).toBe(true);
      expect(secondKeys.some((k) => k.includes('chunk-two'))).toBe(false);
    } finally {
      await watcher.close();
    }
  }, 60_000);
});
