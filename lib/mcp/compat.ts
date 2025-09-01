export const MIN_PLUGIN_VERSION = '0.1.0';

export function versionGte(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10));
  const pb = b.split('.').map((n) => Number.parseInt(n, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return true;
    if (na < nb) return false;
  }
  return true;
}

export function checkCompatibility(pluginVersion?: string) {
  const version = pluginVersion || '0.0.0';
  const ok = versionGte(version, MIN_PLUGIN_VERSION);
  return {
    ok,
    pluginVersion: version,
    minRequired: MIN_PLUGIN_VERSION,
    reason: ok ? null : `Plugin ${version} < required ${MIN_PLUGIN_VERSION}`,
  };
}
