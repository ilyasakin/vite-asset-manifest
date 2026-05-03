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

describe('filter / map / sort', () => {
  it('filter drops non-initial chunks (e.g. dynamic imports)', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: {
        'src/lazy.js': "export const lazy = 42;\n",
        'src/main.js':
          "export default async () => (await import('./lazy.js')).lazy;\n"
      },
      input: { main: 'src/main.js' },
      manifest: {
        filter: (file) => file.isInitial
      }
    });
    const manifest = readManifest(manifestPath);
    expect(Object.keys(manifest)).toEqual(['main.js']);
  });

  it('map can rewrite the descriptor name', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: {
        map: (file) => ({ ...file, name: file.name.toUpperCase() })
      }
    });
    expect(readManifest(manifestPath)).toEqual({ 'MAIN.JS': 'main.js' });
  });

  it('map can fold the path dirname into the name', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      outputPrefix: 'scripts/',
      manifest: {
        map: (file) => {
          const lastSlash = file.path.lastIndexOf('/');
          const dir = lastSlash >= 0 ? file.path.slice(0, lastSlash + 1) : '';
          return { ...file, name: `${dir}${file.name}` };
        }
      }
    });
    expect(readManifest(manifestPath)).toEqual({
      'scripts/main.js': 'scripts/main.js'
    });
  });

  it('sort comparator controls iteration order with a generate callback', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: {
        'src/alpha.js': "export default 'alpha';\n",
        'src/beta.js': "export default 'beta';\n"
      },
      input: { alpha: 'src/alpha.js', beta: 'src/beta.js' },
      manifest: {
        seed: [],
        sort: (a, b) => (a.name === 'alpha.js' ? 1 : b.name === 'alpha.js' ? -1 : 0),
        generate: (seed, files) =>
          (seed as string[]).concat(files.map((f) => f.name)) as unknown as Record<string, unknown>
      }
    });
    expect(readManifest(manifestPath)).toEqual(['beta.js', 'alpha.js']);
  });

  it('uses ViteManifestPlugin directly when no helper is needed', async () => {
    const plugin = ViteManifestPlugin({
      filter: (f) => f.name.endsWith('.js'),
      map: (f) => ({ ...f, name: `mapped/${f.name}` }),
      publicPath: ''
    });
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      plugin
    });
    expect(readManifest(manifestPath)).toEqual({ 'mapped/main.js': 'main.js' });
  });
});
