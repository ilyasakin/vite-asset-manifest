import type { Manifest } from './index.js';

export type ManifestTap = (manifest: Manifest) => Manifest;

/**
 * Minimal SyncWaterfallHook implementation, API-compatible with the subset of
 * tapable / @rspack/lite-tapable that rspack-manifest-plugin exposes.
 */
export class SyncWaterfallHook<T> {
  private taps: Array<{ name: string; fn: (value: T) => T }> = [];

  tap(name: string | { name: string }, fn: (value: T) => T): void {
    const tapName = typeof name === 'string' ? name : name.name;
    this.taps.push({ name: tapName, fn });
  }

  call(value: T): T {
    return this.taps.reduce((acc, tap) => tap.fn(acc), value);
  }
}

export interface ManifestPluginHooks {
  beforeEmit: SyncWaterfallHook<Manifest>;
  afterEmit: SyncWaterfallHook<Manifest>;
}

const hookRegistry = new WeakMap<object, ManifestPluginHooks>();

/**
 * Returns the per-plugin-instance manifest hooks. Pass the plugin object
 * returned by `ViteManifestPlugin(opts)` (or any of its aliases). Mirrors
 * `getCompilerHooks` from rspack-manifest-plugin / webpack-manifest-plugin.
 */
export const getCompilerHooks = (plugin: object): ManifestPluginHooks => {
  let hooks = hookRegistry.get(plugin);
  if (!hooks) {
    hooks = {
      beforeEmit: new SyncWaterfallHook<Manifest>(),
      afterEmit: new SyncWaterfallHook<Manifest>()
    };
    hookRegistry.set(plugin, hooks);
  }
  return hooks;
};
