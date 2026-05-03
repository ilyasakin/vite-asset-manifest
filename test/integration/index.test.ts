import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ViteManifestPlugin,
  getCompilerHooks,
  type Manifest
} from '../../src/index.js';
import {
  createWorkDir,
  readManifest,
  removeWorkDir,
  runBuild,
  writeFixture
} from '../_helpers/build.js';
import { build } from 'vite';

let workDir = '';

beforeEach(() => {
  workDir = createWorkDir();
});

afterEach(() => {
  removeWorkDir(workDir);
});

describe('end-to-end Vite build', () => {
  it('emits manifest.json next to the bundle for a single entry', async () => {
    const { manifestPath, outDir } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' }
    });
    expect(existsSync(join(outDir, 'main.js'))).toBe(true);
    expect(readManifest(manifestPath)).toEqual({ 'main.js': 'main.js' });
  });

  it('writes one manifest per plugin instance when multiple are registered', async () => {
    writeFixture(workDir, 'src/file.js', "export default 'file';\n");

    await build({
      root: workDir,
      logLevel: 'silent',
      configFile: false,
      base: '',
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        write: true,
        rollupOptions: {
          input: { main: join(workDir, 'src/file.js') },
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: '[name].js',
            assetFileNames: '[name][extname]'
          }
        }
      },
      plugins: [
        ViteManifestPlugin({ fileName: 'manifest-a.json', publicPath: '' }),
        ViteManifestPlugin({ fileName: 'manifest-b.json', publicPath: '' })
      ]
    });

    const a = readManifest(join(workDir, 'dist/manifest-a.json'));
    const b = readManifest(join(workDir, 'dist/manifest-b.json'));
    expect(a).toEqual({ 'main.js': 'main.js' });
    expect(b).toEqual({ 'main.js': 'main.js' });
  });

  it('exposes the final manifest via afterEmit for downstream plugins', async () => {
    const plugin = ViteManifestPlugin({ publicPath: '' });
    let received: Manifest | undefined;
    getCompilerHooks(plugin).afterEmit.tap('downstream', (manifest) => {
      received = manifest;
      return manifest;
    });

    await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      plugin
    });

    expect(received).toEqual({ 'main.js': 'main.js' });
  });

});
