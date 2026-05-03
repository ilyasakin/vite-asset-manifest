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

describe('manifest output location (integration)', () => {
  it('emits the manifest at outDir/<fileName> for a relative path', async () => {
    const { manifestPath, outDir } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { fileName: 'rels.manifest.json' }
    });
    expect(manifestPath).toBe(join(outDir, 'rels.manifest.json'));
    expect(existsSync(manifestPath)).toBe(true);
    expect(readManifest(manifestPath)).toEqual({ 'main.js': 'main.js' });
  });

  it('emits the manifest at the absolute path when one is given', async () => {
    const target = join(workDir, 'reports/abs.manifest.json');
    const { manifestPath } = await runBuild(workDir, {
      files: { 'src/file.js': "export default 'file';\n" },
      input: { main: 'src/file.js' },
      manifest: { fileName: target }
    });
    expect(manifestPath).toBe(target);
    expect(existsSync(target)).toBe(true);
    expect(readManifest(target)).toEqual({ 'main.js': 'main.js' });
  });
});
