import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'deploy.yml'),
  'utf8',
);

const beginMarker = '# BEGIN douyin-mini-rpg compression';
const endMarker = '# END douyin-mini-rpg compression';

function embeddedPatcher() {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === 'from pathlib import Path');
  const end = lines.findIndex((line, index) => index > start && line.trim() === 'PY');
  assert.ok(start >= 0 && end > start, 'embedded nginx patcher is missing');
  return lines.slice(start, end).map((line) => line.slice(12)).join('\n');
}

function runPatcher(configPath) {
  const python = process.platform === 'win32' ? 'python' : 'python3';
  return spawnSync(python, ['-', configPath], {
    encoding: 'utf8',
    input: embeddedPatcher(),
  });
}

function deployShell() {
  const lines = workflow.split(/\r?\n/);
  const step = lines.findIndex((line) => line.trim() === '- name: Deploy archive and route domain');
  const script = lines.findIndex((line, index) => index > step && line.trim() === 'script: |');
  assert.ok(step >= 0 && script > step, 'deploy shell block is missing');
  return lines.slice(script + 1)
    .map((line) => line.startsWith('            ') ? line.slice(12) : line)
    .join('\n')
    .replace(/\$\{\{[^\n]*?\}\}/g, 'GITHUB_VALUE');
}

test('defines exactly one managed gzip template with the required directives', () => {
  assert.equal(workflow.split(beginMarker).length - 1, 1);
  assert.equal(workflow.split(endMarker).length - 1, 1);

  const blockStart = workflow.indexOf(beginMarker);
  const blockEnd = workflow.indexOf(endMarker, blockStart);
  assert.ok(blockStart >= 0 && blockEnd > blockStart, 'managed gzip block is missing');
  const block = workflow.slice(blockStart, blockEnd + endMarker.length);
  const lines = block.split(/\r?\n/).map((line) => line.trim());

  for (const directive of [
    'gzip on;',
    'gzip_vary on;',
    'gzip_proxied any;',
    'gzip_comp_level 6;',
    'gzip_min_length 1024;',
    'gzip_types text/plain text/css text/xml application/json application/javascript application/xml application/xml+rss image/svg+xml application/wasm;',
  ]) {
    assert.ok(lines.includes(directive), `missing exact directive: ${directive}`);
  }

  const compressionIndex = workflow.indexOf('compression = r\'\'\'');
  const locationIndex = workflow.indexOf('location = r\'\'\'');
  assert.ok(compressionIndex >= 0 && locationIndex > compressionIndex, 'gzip template must precede game locations');
});

test('patcher lexes exact server directives and balanced locations without touching decoys', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-compression-'));
  const configPath = path.join(tempDir, 'site.conf');
  const targetAtByteZero = [
    'server {',
    '    listen 80;',
    '    server_name mcp.edcedc.cn alias.example;',
    `    set $quoted_marker "${beginMarker} inside a value";`,
    `    ${beginMarker}`,
    '    gzip_comp_level 1;',
    `    ${endMarker}`,
    '    location ^~ /game/douyin-mini-rpg/assets/ {',
    '        if ($request_method = POST) {',
    '            return 405;',
    '        }',
    '        return 404;',
    '    }',
    '    location = /game/douyin-mini-rpg/cocos-js/ { return 404; }',
    '    location /game/douyin-mini-rpg/src/ { return 404; }',
    '    location ^~ /game/douyin-mini-rpg/api/ { if ($deny) { return 403; } return 404; }',
    '    location ^~ /game/douyin-mini-rpg/ { return 404; }',
    '    location /keep/ { if ($keep) { return 204; } return 200; }',
    '}',
  ].join('\n');
  const untouchedDecoy = [
    'server {',
    '    server_name notmcp.edcedc.cn.example;',
    '    # server_name mcp.edcedc.cn; { ignored comment brace',
    "    set $single 'server_name mcp.edcedc.cn; } # BEGIN douyin-mini-rpg compression';",
    '    set $multi "first line {',
    'server_name mcp.edcedc.cn;',
    '# BEGIN douyin-mini-rpg compression',
    'last line }";',
    `    ${beginMarker}`,
    '    gzip off;',
    `    ${endMarker}`,
    '    location ^~ /game/douyin-mini-rpg/assets/ { if ($other) { return 418; } return 419; }',
    '}',
  ].join('\n');
  const secondTarget = [
    'server { listen 81; server_name mirror.example mcp.edcedc.cn;',
    'location ^~ /game/douyin-mini-rpg/assets/ { if ($nested) { return 404; } return 405; }',
    'location = /game/douyin-mini-rpg/cocos-js/ { return 404; }',
    '}',
  ].join('\n');
  const secondUntouched = 'server { server_name unrelated.example; location /keep-two/ { return 206; } }';
  try {
    fs.writeFileSync(
      configPath,
      `${targetAtByteZero}\n\n${untouchedDecoy}\n\n${secondTarget}\n\n${secondUntouched}\n`,
    );

    const firstRun = runPatcher(configPath);
    assert.equal(firstRun.status, 0, firstRun.stderr);
    const first = fs.readFileSync(configPath, 'utf8');
    const secondRun = runPatcher(configPath);
    assert.equal(secondRun.status, 0, secondRun.stderr);
    const second = fs.readFileSync(configPath, 'utf8');

    assert.equal(second, first);
    assert.ok(second.includes(untouchedDecoy), 'near-domain and quoted/comment decoy bytes changed');
    assert.ok(second.endsWith(`${secondUntouched}\n`), 'trailing unrelated server bytes changed');
    assert.equal(second.match(/^\s*gzip_types text\/plain/mg)?.length, 2);
    assert.equal(second.match(/alias \/var\/www\/game\/douyin-mini-rpg\/assets\//g)?.length, 2);
    assert.equal(second.match(/location \/keep\/ \{ if \(\$keep\)/g)?.length, 1);
    assert.doesNotMatch(second, /return 405;\n        }\n        return 404;/);
    assert.doesNotMatch(second, /location = \/game\/douyin-mini-rpg\/cocos-js\/ \{ return 404; \}/);
    assert.match(second, new RegExp(`set \\$quoted_marker "${beginMarker} inside a value";`));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('deploy Actions shell is syntactically valid', (t) => {
  const probe = spawnSync('bash', ['--version'], { encoding: 'utf8' });
  if (probe.error?.code === 'ENOENT') {
    t.skip('bash is not installed');
    return;
  }
  const result = spawnSync('bash', ['-n'], { encoding: 'utf8', input: deployShell() });
  assert.equal(result.status, 0, result.stderr);
});

test('patcher fails without changing a file that has no matching server', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-compression-'));
  const configPath = path.join(tempDir, 'site.conf');
  const original = 'server {\n    server_name unrelated.example;\n    location / { return 204; }\n}\n';
  try {
    fs.writeFileSync(configPath, original);
    const result = runPatcher(configPath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /mcp\.edcedc\.cn server_name not found/);
    assert.equal(fs.readFileSync(configPath, 'utf8'), original);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('keeps immutable asset caching and validates a dynamically discovered gzipped JS response', () => {
  assert.match(workflow, /location \^~ \/game\/douyin-mini-rpg\/assets\/[\s\S]*?expires 30d;[\s\S]*?Cache-Control "public, max-age=2592000, immutable";/);
  assert.match(workflow, /location \^~ \/game\/douyin-mini-rpg\/cocos-js\/[\s\S]*?expires 30d;[\s\S]*?Cache-Control "public, max-age=2592000, immutable";/);
  assert.match(workflow, /sudo nginx -t/);

  assert.match(workflow, /find "\$APP_DIR\/cocos-js"[^\n]*-name '\*\.js'/);
  assert.match(workflow, /if \[ -z "\$JS_FILE" \]; then[\s\S]*?exit 1[\s\S]*?fi/);
  assert.match(workflow, /JS_URL="\/game\/douyin-mini-rpg\/cocos-js\/\$JS_FILE"/);
  assert.match(workflow, /trap '[^']*\$GZIP_HEADERS[^']*' EXIT/);

  const gzipCurl = workflow.match(/curl[^\n]*Accept-Encoding: gzip[^\n]*/)?.[0] ?? '';
  assert.ok(gzipCurl, 'gzip public curl check is missing');
  assert.match(gzipCurl, /-D "\$GZIP_HEADERS"/);
  assert.match(gzipCurl, /-o \/dev\/null/);
  assert.doesNotMatch(gzipCurl, /(?:^|\s)-(?:I|[^\s]*I)/, 'gzip validation must use GET, not HEAD');
  assert.match(gzipCurl, /"http:\/\/\$\{\{ env\.DEPLOY_HOST \}\}\$JS_URL"/);

  assert.match(workflow, /grep[^\n]*Content-Encoding:[^\n]*gzip[^\n]*"\$GZIP_HEADERS"/i);
  assert.match(workflow, /grep[^\n]*Vary:[^\n]*Accept-Encoding[^\n]*"\$GZIP_HEADERS"/i);
  assert.match(workflow, /grep[^\n]*Cache-Control:[^\n]*public[^\n]*max-age=2592000[^\n]*immutable[^\n]*"\$GZIP_HEADERS"/i);
});
