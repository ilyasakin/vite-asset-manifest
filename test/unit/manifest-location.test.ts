import { existsSync } from 'node:fs';
import { join } from 'node:path';
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

describe('manifest fileName', () => {
  it('honors a relative fileName resolved against outDir', async () => {
    const { manifestPath, outDir } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { fileName: 'vite.manifest.json' }
    });
    expect(manifestPath).toBe(join(outDir, 'vite.manifest.json'));
    expect(readManifest(manifestPath)).toEqual({ 'main.js': 'main.js' });
  });

  it('writes to an absolute fileName outside of outDir', async () => {
    const absolute = join(workDir, 'manifest-out', 'absolute.manifest.json');
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { fileName: absolute }
    });
    expect(manifestPath).toBe(absolute);
    expect(existsSync(absolute)).toBe(true);
    expect(readManifest(absolute)).toEqual({ 'main.js': 'main.js' });
  });

  it('writes to a nested relative fileName, creating intermediate directories', async () => {
    const { manifestPath, outDir } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { fileName: 'meta/sub/manifest.json' }
    });
    expect(manifestPath).toBe(join(outDir, 'meta/sub/manifest.json'));
    expect(readManifest(manifestPath)).toEqual({ 'main.js': 'main.js' });
  });
});
