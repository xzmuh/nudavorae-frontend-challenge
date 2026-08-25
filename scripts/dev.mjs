import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'app');
const children = [];

/*
 * One change from the starter's version of this file, and the README says so.
 *
 * It spawned every child with `shell: true` on Windows, which concatenates the
 * command and its arguments into one string instead of escaping them. The stub
 * is spawned as `process.execPath`, and on a default Windows install that is
 * `C:\Program Files\nodejs\node.exe`: the shell splits it at the space and the
 * stub never starts. The shell is only needed to resolve `npm` to `npm.cmd`,
 * so it is now asked for by the one child that needs it.
 */
function run(name, command, args, cwd, { shell = false } = {}) {
  const child = spawn(command, args, { cwd, shell });
  const tag = `[${name}]`;

  const relay = (stream, to) => {
    stream.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n')) {
        if (line.trim() !== '') to.write(`${tag} ${line}\n`);
      }
    });
  };

  relay(child.stdout, process.stdout);
  relay(child.stderr, process.stderr);

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      process.stderr.write(`${tag} exited with ${code}\n`);
    }
    shutdown();
  });

  children.push(child);
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

run('stub', process.execPath, [join(root, 'stub', 'server.mjs')], root);

if (existsSync(join(app, 'package.json'))) {
  run('app', 'npm', ['start'], app, { shell: process.platform === 'win32' });
} else {
  console.log('');
  console.log('  No app/ yet, so only the stub is running.');
  console.log('  Create your Angular application in app/ and this will start both:');
  console.log('');
  console.log('    npx @angular/cli@20 new app --style=css --ssr=false');
  console.log('');
  console.log('  Or restructure the repository however you like and rewrite this file.');
  console.log('');
}
