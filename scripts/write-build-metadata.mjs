import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();

function readIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function resolveGitDir(rootDir) {
  const gitPath = path.join(rootDir, '.git');
  if (!fs.existsSync(gitPath)) {
    return null;
  }

  const stat = fs.statSync(gitPath);
  if (stat.isDirectory()) {
    return gitPath;
  }

  const pointer = readIfExists(gitPath)?.trim() ?? '';
  const match = /^gitdir:\s*(.+)$/im.exec(pointer);
  if (!match) {
    return null;
  }

  return path.resolve(rootDir, match[1].trim());
}

function resolvePackedRef(gitDir, refName) {
  const packedRefs = readIfExists(path.join(gitDir, 'packed-refs'));
  if (!packedRefs) {
    return null;
  }

  for (const line of packedRefs.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || line.startsWith('^')) {
      continue;
    }

    const [sha, name] = line.trim().split(/\s+/, 2);
    if (name === refName && /^[0-9a-f]{40}$/i.test(sha)) {
      return sha;
    }
  }

  return null;
}

export function resolveGitCommitSha(rootDir) {
  const envCommit = String(
    process.env.RAILWAY_GIT_COMMIT_SHA
    || process.env.SOURCE_COMMIT
    || process.env.GIT_COMMIT_SHA
    || process.env.GITHUB_SHA
    || '',
  ).trim();
  if (envCommit) {
    return envCommit;
  }

  const gitDir = resolveGitDir(rootDir);
  if (!gitDir) {
    return null;
  }

  const head = readIfExists(path.join(gitDir, 'HEAD'))?.trim() ?? '';
  if (!head) {
    return null;
  }

  if (/^[0-9a-f]{40}$/i.test(head)) {
    return head;
  }

  if (!head.startsWith('ref: ')) {
    return null;
  }

  const refName = head.slice('ref: '.length).trim();
  const looseRefPath = path.join(gitDir, ...refName.split('/'));
  const looseRef = readIfExists(looseRefPath)?.trim() ?? '';
  if (/^[0-9a-f]{40}$/i.test(looseRef)) {
    return looseRef;
  }

  return resolvePackedRef(gitDir, refName);
}

export function writeBuildMetadata(rootDir = repoRoot) {
  const outputPath = path.join(rootDir, 'build-metadata.json');
  const metadata = {
    git_commit_sha: resolveGitCommitSha(rootDir),
  };

  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
  return { outputPath, metadata };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const { outputPath } = writeBuildMetadata(repoRoot);
  console.log(`wrote build metadata to ${outputPath}`);
}
