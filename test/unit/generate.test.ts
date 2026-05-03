import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

describe('generate option', () => {
  it('lets the caller assemble the manifest object freely', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: {
        generate: (seed, files) =>
          files.reduce(
            (acc, file) => ({
              ...acc,
              [file.name]: { file: file.path, isInitial: file.isInitial }
            }),
            seed
          )
      }
    });
    expect(readManifest(manifestPath)).toEqual({
      'main.js': { file: 'main.js', isInitial: true }
    });
  });

  it('passes the seed through verbatim when nothing else is added', async () => {
    let seedReceived: unknown;
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: {
        seed: { hello: 'world' },
        generate: (seed) => {
          seedReceived = seed;
          return seed;
        }
      }
    });
    expect(seedReceived).toEqual({ hello: 'world' });
    expect(readManifest(manifestPath)).toEqual({ hello: 'world' });
  });

  it('can produce an array manifest', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: {
        seed: [],
        generate: (seed, files) =>
          ((seed as unknown[]).concat(
            files.map((f) => ({ name: f.name, path: f.path }))
          ) as unknown) as Record<string, unknown>
      }
    });
    expect(readManifest(manifestPath)).toEqual([{ name: 'main.js', path: 'main.js' }]);
  });

  it('exposes per-entry chunk lists via the entrypoints argument', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: {
        'src/one.js': "export default 'one';\n",
        'src/two.js': "export default 'two';\n"
      },
      input: { one: 'src/one.js', two: 'src/two.js' },
      manifest: {
        generate: (seed, files, entrypoints) => ({
          entrypoints,
          files: files.reduce(
            (acc, f) => Object.assign(acc, { [f.name]: f.path }),
            seed
          )
        })
      }
    });
    expect(readManifest(manifestPath)).toEqual({
      entrypoints: { one: ['one.js'], two: ['two.js'] },
      files: { 'one.js': 'one.js', 'two.js': 'two.js' }
    });
  });

  it('passes a context with bundle and config when generating', async () => {
    let contextKeys: string[] = [];
    await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: {
        generate: (seed, _files, _entries, context) => {
          contextKeys = Object.keys(context).sort();
          return seed;
        }
      }
    });
    expect(contextKeys).toEqual(['bundle', 'config']);
  });
});
