import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ViteManifestPlugin, getCompilerHooks, type Manifest } from '../../src/index.js';
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

describe('beforeEmit / afterEmit hooks', () => {
  it('beforeEmit can append properties before the manifest is serialized', async () => {
    const plugin = ViteManifestPlugin({ publicPath: '' });
    getCompilerHooks(plugin).beforeEmit.tap('inject', (m) => ({
      ...m,
      injected: 'value'
    }));

    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      plugin
    });

    expect(readManifest(manifestPath)).toEqual({
      'main.js': 'main.js',
      injected: 'value'
    });
  });

  it('afterEmit observes the final manifest after beforeEmit transforms', async () => {
    const plugin = ViteManifestPlugin({ publicPath: '' });
    let observed: Manifest | undefined;

    getCompilerHooks(plugin).beforeEmit.tap('mutate', (m) => ({ ...m, stage: 'before' }));
    getCompilerHooks(plugin).afterEmit.tap('observe', (m) => {
      observed = m;
      return m;
    });

    await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      plugin
    });

    expect(observed).toEqual({ 'main.js': 'main.js', stage: 'before' });
  });

  it('multiple beforeEmit taps run in registration order', async () => {
    const plugin = ViteManifestPlugin({ publicPath: '' });
    const hooks = getCompilerHooks(plugin);
    const trace: string[] = [];

    hooks.beforeEmit.tap('first', (m) => {
      trace.push('first');
      return { ...m, order: 'first' };
    });
    hooks.beforeEmit.tap('second', (m) => {
      trace.push('second');
      return { ...m, order: `${m.order as string}+second` };
    });

    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      plugin
    });

    expect(trace).toEqual(['first', 'second']);
    const manifest = readManifest<Record<string, string>>(manifestPath);
    expect(manifest.order).toBe('first+second');
  });
});
