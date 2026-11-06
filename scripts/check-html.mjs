import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
if (!blocks.length) throw new Error('No inline JavaScript blocks found');
let failed = false;
blocks.forEach((source, i) => {
  const file = path.join(os.tmpdir(), 'scholars-inline-' + i + '.js');
  fs.writeFileSync(file, source);
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) { failed = true; process.stderr.write('Inline script ' + (i + 1) + ':\n' + result.stderr); }
});
if (failed) process.exit(1);
console.log('Checked ' + blocks.length + ' inline JavaScript blocks.');
