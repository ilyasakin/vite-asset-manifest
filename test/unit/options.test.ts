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

describe('removeKeyHash', () => {
  // Chunk-keyed entries always read as "<chunkName>.<ext>" and never contain a
  // hash, so removeKeyHash exists for keys derived from upstream sources whose
  // filenames already embed a hash — most commonly module-asset paths emitted
  // from imported files. The default regex matches md5-style hex hashes.

  it('strips a hex hash that leaks through a module-asset key', async () => {
    const hexHash = 'abcd1234ef567890abcd1234ef567890';
    const { manifestPath } = await runBuild(workDir, {
      files: {
        [`assets/icon.${hexHash}.svg`]:
          '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>\n',
        'src/file.js':
          `import url from '../assets/icon.${hexHash}.svg';\nexport default url;\n`
      },
      input: { main: 'src/file.js' }
    });
    const manifest = readManifest<Record<string, string>>(manifestPath);
    // Default regex `/([a-f0-9]{16,32}\.?)/gi` strips the hash plus the dot
    // that follows it, turning "icon.abcd…7890.svg" into "icon.svg".
    expect(manifest['icon.svg']).toBeDefined();
  });

  it('preserves the hash in the key when set to false', async () => {
    const hexHash = 'abcd1234ef567890abcd1234ef567890';
    const { manifestPath } = await runBuild(workDir, {
      files: {
        [`assets/icon.${hexHash}.svg`]:
          '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>\n',
        'src/file.js':
          `import url from '../assets/icon.${hexHash}.svg';\nexport default url;\n`
      },
      input: { main: 'src/file.js' },
      manifest: { removeKeyHash: false }
    });
    const manifest = readManifest<Record<string, string>>(manifestPath);
    expect(manifest[`icon.${hexHash}.svg`]).toBeDefined();
    expect(manifest['icon.svg']).toBeUndefined();
  });

  it('accepts a caller-supplied regex matching arbitrary hash formats', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: {
        'assets/icon.HASH-XYZ.svg':
          '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>\n',
        'src/file.js':
          "import url from '../assets/icon.HASH-XYZ.svg';\nexport default url;\n"
      },
      input: { main: 'src/file.js' },
      manifest: { removeKeyHash: /HASH-XYZ\.?/g }
    });
    const manifest = readManifest<Record<string, string>>(manifestPath);
    expect(manifest['icon.svg']).toBeDefined();
  });
});

describe('useEntryKeys', () => {
  it('drops the file extension from entry chunk keys', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: {
        'src/main.js': "export default 'main';\n",
        'src/other.js': "export default 'other';\n"
      },
      input: { main: 'src/main.js', other: 'src/other.js' },
      manifest: { useEntryKeys: true }
    });
    expect(readManifest(manifestPath)).toEqual({
      main: 'main.js',
      other: 'other.js'
    });
  });

  it('still keeps the .map extension when useEntryKeys is true', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: {
        'src/lib.js':
          "export const greet = (n) => `hello ${n}`;\nexport const counter = { value: 0 };\n",
        'src/main.js':
          "import { greet, counter } from './lib.js';\ncounter.value += 1;\nconsole.log(greet('world'), counter.value);\n"
      },
      input: { main: 'src/main.js' },
      sourcemap: true,
      manifest: { useEntryKeys: true }
    });
    expect(readManifest(manifestPath)).toEqual({
      main: 'main.js',
      'main.js.map': 'main.js.map'
    });
  });
});

describe('serialize', () => {
  it('replaces JSON output entirely', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: {
        fileName: 'manifest.txt',
        serialize: (m) =>
          Object.entries(m)
            .map(([k, v]) => `${k}|${String(v)}`)
            .join('\n')
      }
    });
    const text = (await import('node:fs')).readFileSync(manifestPath, 'utf8');
    expect(text.split('\n')).toContain('main.js|main.js');
  });
});

describe('writeToFileEmit', () => {
  it('writes the manifest to disk in addition to the bundle', async () => {
    const { manifestPath, outDir } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { writeToFileEmit: true }
    });
    expect(manifestPath).toBe(`${outDir}/manifest.json`);
    expect(readManifest(manifestPath)).toEqual({ 'main.js': 'main.js' });
  });
});

describe('transformExtensions', () => {
  it('treats compound extensions as a single suffix when generating chunk keys', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: {
        'src/lib.js':
          "export const greet = (n) => `hello ${n}`;\nexport const counter = { value: 0 };\n",
        'src/main.js':
          "import { greet, counter } from './lib.js';\ncounter.value += 1;\nconsole.log(greet('world'), counter.value);\n"
      },
      input: { main: 'src/main.js' },
      sourcemap: true
    });
    const manifest = readManifest<Record<string, string>>(manifestPath);
    expect(manifest['main.js.map']).toBe('main.js.map');
  });
});
