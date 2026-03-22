function normalizePrefix(prefix) {
  const trimmed = String(prefix || '').trim();
  if (!trimmed || trimmed === '/') return '';
  return trimmed.startsWith('/') ? trimmed.replace(/\/$/, '') : `/${trimmed.replace(/\/$/, '')}`;
}

export function createMountAwarePathRewrite(prefix) {
  const normalizedPrefix = normalizePrefix(prefix);

  return function rewrite(path) {
    const normalizedPath = String(path || '/').startsWith('/') ? String(path || '/') : `/${String(path || '/')}`;
    if (!normalizedPrefix) {
      return normalizedPath;
    }
    if (normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`)) {
      return normalizedPath;
    }
    if (normalizedPath === '/') {
      return normalizedPrefix;
    }
    return `${normalizedPrefix}${normalizedPath}`;
  };
}
