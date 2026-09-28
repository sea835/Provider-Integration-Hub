import { spawnSync } from 'child_process';

const rawArgs = process.argv.slice(2);
let name = process.env.npm_config_name;
const forwardArgs: string[] = [];

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg.startsWith('--name=')) {
    name = arg.slice(7);
  } else if (arg === '--name' || arg === '-n') {
    name = rawArgs[++i];
  } else if (!arg.startsWith('-') && !name) {
    name = arg;
  } else {
    forwardArgs.push(arg);
  }
}

const drizzleArgs = [
  'generate',
  '--config=src/infrastructure/database/drizzle.config.ts',
  ...(name ? [`--name=${name}`] : []),
  ...forwardArgs,
];

const result = spawnSync('drizzle-kit', drizzleArgs, {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 0);
