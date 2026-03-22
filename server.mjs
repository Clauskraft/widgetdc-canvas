import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMountAwarePathRewrite } from './serverRuntime.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const port = Number(process.env.PORT || 8080);
const distDir = path.join(__dirname, 'dist');
const backendTarget = process.env.BACKEND_URL || 'https://backend-production-d3da.up.railway.app';
const rlmTarget = process.env.RLM_URL || 'https://rlm-engine-production.up.railway.app';

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    runtime_fingerprint: {
      deployment_id: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
      service_name: process.env.RAILWAY_SERVICE_NAME ?? null,
      git_commit_sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
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

app.use(express.static(distDir));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`canvas runtime listening on ${port}`);
});
