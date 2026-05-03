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

const startWatcher = async (root: string): Promise<Rollup.RollupWatcher> => {
  const result = await build({
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
          entryFileNames: '[name]-[hash].js',
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: '[name]-[hash][extname]'
        }
      }
    },
    plugins: [ViteManifestPlugin({ publicPath: '' })]
  });

  return result as Rollup.RollupWatcher;
};

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

describe('watch mode', () => {
  it('rebuilds the manifest when an entry source changes, and the hash rotates', async () => {
    writeFixture(workDir, 'src/main.js', "console.log('v1');\n");

    const watcher = await startWatcher(workDir);
    const manifestPath = join(workDir, 'dist/manifest.json');

    try {
      await waitUntil(() => existsSync(manifestPath));
      const first = readManifest<Record<string, string>>(manifestPath);
      expect(Object.keys(first)).toEqual(['main.js']);
      const firstPath = first['main.js'];
      expect(firstPath).toMatch(/^main-[A-Za-z0-9_-]+\.js$/);

      const nextEnd = waitForNextEnd(watcher);
      writeFileSync(join(workDir, 'src/main.js'), "console.log('v2-changed');\n");
      await nextEnd;

      // Rollup writes asset files after END fires; give the writeBundle phase a
      // beat to land before reading the manifest back.
      await waitUntil(() => {
        try {
          const m = readManifest<Record<string, string>>(manifestPath);
          return m['main.js'] !== firstPath;
        } catch {
          return false;
        }
      });

      const second = readManifest<Record<string, string>>(manifestPath);
      expect(Object.keys(second)).toEqual(['main.js']);
      expect(second['main.js']).toMatch(/^main-[A-Za-z0-9_-]+\.js$/);
      expect(second['main.js']).not.toBe(firstPath);
    } finally {
      await watcher.close();
    }
  }, 60_000);
});
