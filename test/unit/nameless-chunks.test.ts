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

describe('dynamic-import chunks (Vite analog of nameless chunks)', () => {
  it('produces a separate manifest entry for each dynamically-imported module', async () => {
    const { manifestPath } = await runBuild(workDir, {
      files: {
        'src/lazy.js': "export const lazy = 'lazy';\n",
        'src/main.js':
          "(async () => { const m = await import('./lazy.js'); console.log(m); })();\n"
      },
      input: { main: 'src/main.js' }
    });
    const manifest = readManifest<Record<string, string>>(manifestPath);
    expect(manifest['main.js']).toBe('main.js');
    const lazyKey = Object.keys(manifest).find((k) => k.includes('lazy'));
    expect(lazyKey).toBeDefined();
    expect(manifest[lazyKey!]).toMatch(/lazy/);
  });

  it('marks the dynamic chunk as non-initial', async () => {
    const seen: { name: string; isInitial: boolean }[] = [];
    await runBuild(workDir, {
      files: {
        'src/lazy.js': "export const lazy = 'lazy';\n",
        'src/main.js':
          "(async () => { const m = await import('./lazy.js'); console.log(m); })();\n"
      },
      input: { main: 'src/main.js' },
      manifest: {
        generate: (seed, files) => {
          for (const f of files) seen.push({ name: f.name, isInitial: f.isInitial });
          return seed;
        }
      }
    });
    const main = seen.find((f) => f.name === 'main.js');
    const lazy = seen.find((f) => f.name.includes('lazy'));
    expect(main?.isInitial).toBe(true);
    expect(lazy?.isInitial).toBe(false);
  });
});
