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

describe('basePath / publicPath', () => {
  it('basePath prefixes manifest keys but leaves seed attributes untouched', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: {
        basePath: '/app/',
        publicPath: '/app/',
        seed: { staticKey: 'staticValue' }
      }
    });
    expect(readManifest(manifestPath)).toEqual({
      '/app/main.js': '/app/main.js',
      staticKey: 'staticValue'
    });
  });

  it('basePath without publicPath only affects keys', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { basePath: '/app/' }
    });
    expect(readManifest(manifestPath)).toEqual({ '/app/main.js': 'main.js' });
  });

  it('publicPath prefixes manifest values', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { publicPath: '/app/' }
    });
    expect(readManifest(manifestPath)).toEqual({ 'main.js': '/app/main.js' });
  });

  it('treats publicPath="auto" as no prefix', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { publicPath: 'auto' }
    });
    expect(readManifest(manifestPath)).toEqual({ 'main.js': 'main.js' });
  });

  it('basePath still applies when publicPath is "auto"', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { publicPath: 'auto', basePath: '/app/' }
    });
    expect(readManifest(manifestPath)).toEqual({ '/app/main.js': 'main.js' });
  });

  it('plugin publicPath overrides Vite base', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      base: '/site/',
      manifest: { publicPath: '/cdn/' }
    });
    expect(readManifest(manifestPath)).toEqual({ 'main.js': '/cdn/main.js' });
  });

  it('inherits Vite base as the default publicPath', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      base: '/from-vite-base/',
      inheritPublicPath: true
    });
    expect(readManifest(manifestPath)).toEqual({
      'main.js': '/from-vite-base/main.js'
    });
  });

  it('keeps a fully-qualified URL when given as basePath', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { basePath: 'https://example.test/' }
    });
    expect(readManifest(manifestPath)).toEqual({
      'https://example.test/main.js': 'main.js'
    });
  });

  it('keeps a fully-qualified URL when given as publicPath', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { publicPath: 'https://cdn.example.test/' }
    });
    expect(readManifest(manifestPath)).toEqual({
      'main.js': 'https://cdn.example.test/main.js'
    });
  });

  it('appends a trailing slash to basePath / publicPath when missing', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { basePath: '/app', publicPath: '/cdn' }
    });
    expect(readManifest(manifestPath)).toEqual({
      '/app/main.js': '/cdn/main.js'
    });
  });

  it('emits forward-slash paths even on platforms that may produce backslashes', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      outputPrefix: 'nested/dir/',
      manifest: { basePath: '/x/' }
    });
    const manifest = readManifest<Record<string, string>>(manifestPath);
    for (const key of Object.keys(manifest)) {
      expect(key).not.toContain('\\');
      expect(manifest[key]).not.toContain('\\');
    }
  });
});
