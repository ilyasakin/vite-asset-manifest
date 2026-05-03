import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  RspackManifestPlugin,
  ViteManifestPlugin,
  WebpackManifestPlugin,
  getCompilerHooks
} from '../../src/index.js';
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

describe('public exports', () => {
  it('exposes ViteManifestPlugin and getCompilerHooks', () => {
    expect(typeof ViteManifestPlugin).toBe('function');
    expect(typeof getCompilerHooks).toBe('function');
  });

  it('aliases RspackManifestPlugin and WebpackManifestPlugin to the same factory', () => {
    expect(RspackManifestPlugin).toBe(ViteManifestPlugin);
    expect(WebpackManifestPlugin).toBe(ViteManifestPlugin);
  });

  it('returns a stable hook bag per plugin instance', () => {
    const plugin = ViteManifestPlugin();
    const a = getCompilerHooks(plugin);
    const b = getCompilerHooks(plugin);
    expect(a).toBe(b);
    expect(typeof a.beforeEmit.tap).toBe('function');
    expect(typeof a.afterEmit.tap).toBe('function');
  });

  it('returns distinct hook bags for distinct plugin instances', () => {
    const a = ViteManifestPlugin();
    const b = ViteManifestPlugin();
    expect(getCompilerHooks(a)).not.toBe(getCompilerHooks(b));
  });
});

describe('happy-path manifest output', () => {
  it('emits a manifest with a single entry', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' }
    });
    expect(readManifest(manifestPath)).toEqual({ 'main.js': 'main.js' });
  });

  it('emits a manifest with multiple named entries', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: {
        'src/one.js': "export default 'one';\n",
        'src/two.js': "export default 'two';\n"
      },
      input: { one: 'src/one.js', two: 'src/two.js' }
    });
    expect(readManifest(manifestPath)).toEqual({
      'one.js': 'one.js',
      'two.js': 'two.js'
    });
  });

  it('keeps the hashed file name in the manifest value', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { one: 'src/file.js' },
      hashed: true
    });
    const manifest = readManifest<Record<string, string>>(manifestPath);
    expect(Object.keys(manifest)).toEqual(['one.js']);
    expect(manifest['one.js']).toMatch(/^one-[A-Za-z0-9_-]{8}\.js$/);
  });

  it('includes source-map files alongside the chunk', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: {
        'src/lib.js':
          "export const greet = (n) => `hello ${n}`;\nexport const counter = { value: 0 };\n",
        'src/file.js':
          "import { greet, counter } from './lib.js';\ncounter.value += 1;\nconsole.log(greet('world'), counter.value);\n"
      },
      input: { one: 'src/file.js' },
      sourcemap: true
    });
    expect(readManifest(manifestPath)).toEqual({
      'one.js': 'one.js',
      'one.js.map': 'one.js.map'
    });
  });

  it('merges seed attributes into the manifest', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { one: 'src/file.js' },
      manifest: { seed: { brand: 'gotham' } }
    });
    expect(readManifest(manifestPath)).toEqual({
      'one.js': 'one.js',
      brand: 'gotham'
    });
  });

  it('keys imported assets by their source filename', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: {
        'assets/icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>\n',
        'src/file.js': "import url from '../assets/icon.svg';\nexport default url;\n"
      },
      input: { main: 'src/file.js' }
    });
    const manifest = readManifest<Record<string, string>>(manifestPath);
    expect(manifest['main.js']).toBe('main.js');
    expect(manifest['icon.svg']).toBe('icon.svg');
  });
});
