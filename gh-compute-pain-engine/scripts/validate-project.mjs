import { spawnSync } from 'node:child_process';

const commands = [
  ['node', ['tests/validate-workflows.mjs']],
  ['node', ['tests/test-scoring.mjs']],
  ['node', ['tests/test-normalization.mjs']]
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('validate-project: ok');
