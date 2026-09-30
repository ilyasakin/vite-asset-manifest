import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'vite-asset-manifest-package-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const options = { encoding: 'utf8', shell: process.platform === 'win32' };

try {
  // Exercise the prepack build and published allowlist, not the source entrypoint.
  const [packed] = JSON.parse(execFileSync(npm, [
    'pack', '--json', '--pack-destination', directory, '--cache', join(directory, 'cache')
  ], options));
  const files = new Set(packed.files.map(({ path }) => path));
  for (const file of ['dist/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE']) {
    assert.ok(files.has(file), `Missing published file: ${file}`);
  }
  assert.ok([...files].every((file) =>
    file.startsWith('dist/') || ['package.json', 'README.md', 'LICENSE'].includes(file)
  ), 'The package includes unexpected files');

  writeFileSync(join(directory, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync(npm, [
    'install', join(directory, packed.filename), '--offline', '--ignore-scripts',
    '--legacy-peer-deps', '--no-audit', '--no-fund', '--cache', join(directory, 'cache')
  ], { ...options, cwd: directory });
  execFileSync(process.execPath, ['--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    import DefaultPlugin, { ViteManifestPlugin, getCompilerHooks, SyncWaterfallHook }
      from 'vite-asset-manifest';
    assert.equal(DefaultPlugin, ViteManifestPlugin);
    const plugin = ViteManifestPlugin();
    assert.equal(plugin.name, 'vite-asset-manifest');
    assert.ok(getCompilerHooks(plugin).beforeEmit instanceof SyncWaterfallHook);
  `], { ...options, cwd: directory });
  console.log('Packed package contents and ESM exports verified');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
