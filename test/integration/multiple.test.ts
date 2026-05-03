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
