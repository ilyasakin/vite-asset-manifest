import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ViteManifestPlugin } from '../../src/index.js';
import {
  createWorkDir,
  readManifest,
  removeWorkDir,
  runBuild
} from '../_helpers/build.js';

let workDir = '';

beforeEach(() => {
  workDir = createWorkDir();
});

afterEach(() => {
  removeWorkDir(workDir);
});

describe('multiple sequential builds (Vite analog of multi-compiler mode)', () => {
  it('does not exclude assets that were manifest names in a previous build', async () => {
    await runBuild(workDir, {
      files: { 'src/file.js': "console.log('first');\n" },
      input: { main: 'src/file.js' },
      manifest: { fileName: 'data.json' }
    });

    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "console.log('second');\n" },
      input: { main: 'src/file.js' },
      extraPlugins: [{
        name: 'emit-data',
        buildStart() {
          this.emitFile({ type: 'asset', fileName: 'data.json', source: '{}' });
        }
      }]
    });

    expect(readManifest(manifestPath)).toEqual({
      'main.js': 'main.js',
      'data.json': 'data.json'
    });
  });

  it('accumulates manifest entries across builds when a shared seed object is passed', async () => {
    const seed: Record<string, unknown> = {};
    const totalBuilds = 5;

    for (let i = 0; i < totalBuilds; i += 1) {
      const entryName = `chunk-${i}`;
      removeWorkDir(workDir);
      workDir = createWorkDir();

      await runBuild(workDir, {
        files: { [`src/${entryName}.js`]: `export default ${i};\n` },
        input: { [entryName]: `src/${entryName}.js` },
        plugin: ViteManifestPlugin({ seed, publicPath: '' })
      });
    }

    expect(Object.keys(seed).length).toBe(totalBuilds);
    for (let i = 0; i < totalBuilds; i += 1) {
      expect(seed[`chunk-${i}.js`]).toBe(`chunk-${i}.js`);
    }
  });

  it('produces independent manifest files for builds that do not share a seed', async () => {
    const aDir = createWorkDir();
    const bDir = createWorkDir();

    try {
      const a = await runBuild(aDir, {
        files: { 'src/file.js': "export default 'a';\n" },
        input: { main: 'src/file.js' },
        outDir: 'dist'
      });
      const b = await runBuild(bDir, {
        files: { 'src/file.js': "export default 'b';\n" },
        input: { main: 'src/file.js' },
        outDir: 'dist'
      });

      expect(a.manifestPath).toBe(join(aDir, 'dist/manifest.json'));
      expect(b.manifestPath).toBe(join(bDir, 'dist/manifest.json'));
      expect(readManifest(a.manifestPath)).toEqual({ 'main.js': 'main.js' });
      expect(readManifest(b.manifestPath)).toEqual({ 'main.js': 'main.js' });
    } finally {
      removeWorkDir(aDir);
      removeWorkDir(bDir);
    }
  });
});
