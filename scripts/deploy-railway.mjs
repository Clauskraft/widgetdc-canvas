import { spawnSync } from 'node:child_process';
import { resolveGitCommitSha } from './write-build-metadata.mjs';

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const commitSha = resolveGitCommitSha(process.cwd());
if (!commitSha) {
  console.error('Could not resolve the current git commit SHA for Railway deploy.');
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');
const steps = [
  ['railway', ['variables', '--set', `SOURCE_COMMIT=${commitSha}`]],
  ['railway', ['up', '-d']],
];

if (isDryRun) {
  for (const [command, args] of steps) {
    console.log([command, ...args].join(' '));
  }
  process.exit(0);
}

for (const [command, args] of steps) {
  run(command, args);
}
