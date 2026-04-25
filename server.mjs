import express from 'express';
import fs from 'node:fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createMountAwarePathRewrite,
  resolveProxyAuthHeaders,
  resolveRuntimeGitCommitSha,
} from './serverRuntime.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const port = Number(process.env.PORT || 8080);
const distDir = path.join(__dirname, 'dist');
const backendTarget = process.env.BACKEND_URL || 'https://backend-production-d3da.up.railway.app';
const rlmTarget = process.env.RLM_URL || 'https://rlm-engine-production.up.railway.app';
const buildMetadataPath = path.join(__dirname, 'build-metadata.json');

function loadBuildMetadata() {
  if (!fs.existsSync(buildMetadataPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(buildMetadataPath, 'utf8'));
  } catch (_error) {
    return {};
  }
}

const buildMetadata = loadBuildMetadata();

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    runtime_fingerprint: {
      deployment_id: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
      service_name: process.env.RAILWAY_SERVICE_NAME ?? null,
      git_commit_sha: resolveRuntimeGitCommitSha(process.env, buildMetadata),
    },
  });
});

app.use(
  '/api',
  createProxyMiddleware({
    target: backendTarget,
    changeOrigin: true,
    secure: true,
    pathRewrite: createMountAwarePathRewrite('/api'),
    on: {
      proxyReq(proxyReq, req) {
        const authHeaders = resolveProxyAuthHeaders(process.env, req.headers);
        for (const [headerName, headerValue] of Object.entries(authHeaders)) {
          proxyReq.setHeader(headerName, headerValue);
        }
      },
    },
  }),
);

app.use(
  '/reason',
  createProxyMiddleware({
    target: rlmTarget,
    changeOrigin: true,
    secure: true,
    pathRewrite: createMountAwarePathRewrite('/reason'),
  }),
);

app.use(
  '/intelligence',
  createProxyMiddleware({
    target: rlmTarget,
    changeOrigin: true,
    secure: true,
    pathRewrite: createMountAwarePathRewrite('/intelligence'),
  }),
);

// LIN-964 / A8 — public verifiable demo pack. Static page that fetches a
// signed WorkArtifact and validates its Ed25519 signature client-side via
// @noble/ed25519. No third-party data flow; no auth required.
const publicDir = path.join(__dirname, 'public');
app.use('/verify', express.static(publicDir));
app.get('/verify', (_req, res) => {
  res.sendFile(path.join(publicDir, 'verify.html'));
});

app.use(express.static(distDir));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`canvas runtime listening on ${port}`);
});
