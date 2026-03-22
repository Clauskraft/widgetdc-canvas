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

function readConfiguredApiKey(env) {
  return String(
    env?.BACKEND_API_KEY
    || env?.MCP_API_KEY
    || env?.VITE_API_KEY
    || '',
  ).trim();
}

function hasBearerToken(value) {
  const trimmed = String(value || '').trim();
  return trimmed.toLowerCase().startsWith('bearer ') && trimmed.length > 'bearer '.length;
}

export function resolveProxyAuthHeaders(env = process.env, incomingHeaders = {}) {
  const configuredApiKey = readConfiguredApiKey(env);
  if (!configuredApiKey) {
    return {};
  }

  const authHeader = incomingHeaders.authorization ?? incomingHeaders.Authorization ?? '';
  const apiKeyHeader = incomingHeaders['x-api-key'] ?? incomingHeaders['X-API-Key'] ?? '';

  return {
    ...(hasBearerToken(authHeader) ? {} : { authorization: `Bearer ${configuredApiKey}` }),
    ...(String(apiKeyHeader || '').trim() ? {} : { 'x-api-key': configuredApiKey }),
  };
}
