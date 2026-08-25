/*
 * RF9, checked rather than promised.
 *
 * The rule the starter states — "components never read a primitive directly" —
 * and the rule the brief states — "no colour value appears outside your token
 * file" — are both greppable, so they are checked here instead of waiting for
 * a reviewer to grep for them.
 *
 * Three findings, any of which fail the run:
 *
 *   1. a colour value outside the two token files;
 *   2. a `--nud-*` primitive read from anywhere but the semantic layer;
 *   3. a semantic token used by a component and defined nowhere.
 *
 * `npm run lint:tokens`
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** The starter's primitives. Not ours to edit, and not ours to read. */
const PALETTE = 'tokens/palette.css';
/** Ours: the only file allowed to hold a colour or to name a primitive. */
const SEMANTIC = 'app/src/styles/semantic.css';

const SEARCH = ['app/src', 'tokens'];
const EXTENSIONS = new Set(['.ts', '.css', '.html']);

/** Hex colours, and the functional notations that carry one. */
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g;
const PRIMITIVE = /var\(\s*(--nud-[a-z0-9-]+)/g;
const CONSUMED = /var\(\s*(--[a-z0-9-]+)/g;
const DECLARED = /^\s*(--[a-z0-9-]+)\s*:/gm;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      yield* walk(full);
      continue;
    }
    if (EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) yield full;
  }
}

const findings = [];
const defined = new Set();
const consumed = new Map();

for (const match of readFileSync(join(ROOT, SEMANTIC), 'utf8').matchAll(DECLARED)) {
  defined.add(match[1]);
}

for (const base of SEARCH) {
  for (const file of walk(join(ROOT, base))) {
    const rel = relative(ROOT, file).split(sep).join('/');
    if (rel === PALETTE) continue;

    const lines = readFileSync(file, 'utf8').split('\n');

    lines.forEach((line, index) => {
      const at = `${rel}:${index + 1}`;
      // A quoted mention inside a comment is prose, not a paint instruction.
      const isComment = /^\s*(\*|\/\/|<!--)/.test(line);

      if (rel !== SEMANTIC && !isComment) {
        for (const match of line.matchAll(COLOUR)) {
          findings.push(`${at}  colour outside the token files: ${match[0]}`);
        }
        for (const match of line.matchAll(PRIMITIVE)) {
          findings.push(`${at}  primitive read by a component: ${match[1]}`);
        }
      }

      if (rel !== SEMANTIC && !isComment) {
        for (const match of line.matchAll(CONSUMED)) {
          if (!consumed.has(match[1])) consumed.set(match[1], at);
        }
      }
    });
  }
}

for (const [token, at] of consumed) {
  if (token.startsWith('--nud-')) continue;
  if (!defined.has(token)) findings.push(`${at}  no such semantic token: ${token}`);
}

if (findings.length === 0) {
  console.log(
    `tokens ok — ${defined.size} semantic tokens, no colour and no primitive outside them`,
  );
  process.exit(0);
}

console.error(`RF9: ${findings.length} finding(s)\n`);
for (const finding of findings) console.error(`  ${finding}`);
process.exit(1);
