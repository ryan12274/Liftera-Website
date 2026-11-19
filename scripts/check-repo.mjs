import { readdir, readFile, access } from 'node:fs/promises';
import { dirname, extname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set([
  '.git', '.wrangler', 'node_modules', 'outputs', 'dist', 'build',
  'coverage', 'playwright-report', 'test-results', '.vscode', '.idea'
]);
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name.startsWith('.env') ||
        entry.name.startsWith('.dev.vars')) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile()) files.push(path);
  }
}

const errors = [];
let references = 0;
async function checkReference(source, raw) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/i.test(raw) || !raw) return;
  let path;
  try {
    path = decodeURIComponent(raw.split(/[?#]/, 1)[0]);
  } catch {
    errors.push(relative(root, source) + ': malformed URL ' + raw);
    return;
  }
  if (!path || path === '/api' || path.startsWith('/api/')) return;
  const target = path.startsWith('/')
    ? resolve(root, '.' + path)
    : resolve(dirname(source), path);
  const fromRoot = relative(root, target);
  if (fromRoot === '..' || fromRoot.startsWith('..' + sep)) {
    errors.push(relative(root, source) + ': reference leaves repository: ' + raw);
    return;
  }
  const candidates = extname(target)
    ? [target]
    : [target, target + '.html', resolve(target, 'index.html')];
  let exists = false;
  for (const candidate of candidates) {
    try { await access(candidate); exists = true; break; } catch {}
  }
  references++;
  if (!exists) errors.push(relative(root, source) + ': missing local file ' + raw);
}

await walk(root);
for (const file of files) {
  const extension = extname(file);
  if (extension === '.js' || extension === '.mjs') {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
      errors.push(relative(root, file) + ': ' + (result.stderr || result.error?.message || 'syntax check failed').trim());
    }
  }
  if (!['.json', '.html', '.css', '.md', '.js', '.mjs'].includes(extension)) continue;
  const source = await readFile(file, 'utf8');
  if (extension === '.json') {
    try { JSON.parse(source); } catch (error) {
      errors.push(relative(root, file) + ': invalid JSON: ' + error.message);
    }
  }
  if (extension === '.html' || extension === '.md') {
    for (const tag of source.matchAll(/<[^>]+>/g)) {
      for (const match of tag[0].matchAll(/\s(?:src|href|poster|action)\s*=\s*["']([^"']+)["']/gi)) {
        await checkReference(file, match[1]);
      }
    }
  }
  if (extension === '.css') {
    for (const match of source.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) {
      await checkReference(file, match[1]);
    }
  }
  if (extension === '.md') {
    for (const match of source.matchAll(/\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^)]*)?\)/g)) {
      await checkReference(file, match[1] || match[2]);
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Passed: JavaScript syntax, JSON, and ' + references + ' local file references.');
}
