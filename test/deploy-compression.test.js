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
});

test('removes the old managed block before inserting gzip after server_name and before locations', () => {
  const removalIndex = workflow.indexOf("managed_pattern.sub('', block)");
  const insertionIndex = workflow.indexOf("server_name_pattern.sub(r'\\1' + compression + location, block, count=1)");
  assert.ok(removalIndex >= 0, 'managed gzip removal is missing');
  assert.ok(insertionIndex > removalIndex, 'managed gzip must be removed before insertion');
  assert.match(workflow, /managed_pattern\s*=\s*re\.compile\([\s\S]*?re\.S\)/);

  const compressionIndex = workflow.indexOf('compression = r\'\'\'');
  const locationIndex = workflow.indexOf('location = r\'\'\'');
  assert.ok(compressionIndex >= 0 && locationIndex > compressionIndex, 'gzip template must precede game locations');
  assert.match(workflow, /server_name_pattern\s*=\s*re\.compile\(r'\(\^[^']*server_name[^']*'[^\n]*re\.M\)[\s\S]*?server_name_pattern\.sub\(r'\\1' \+ compression \+ location, block, count=1\)/);
});

test('patcher only updates the matching server and is byte-idempotent', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-compression-'));
  const configPath = path.join(tempDir, 'site.conf');
  const unrelatedServer = [
    'server {',
    '    server_name unrelated.example;',
    '    # A comment with misleading braces { } must not affect server parsing.',
    '    set $brace_text "literal } then {";',
    `    ${beginMarker}`,
    '    gzip off;',
    `    ${endMarker}`,
    '    location ^~ /game/douyin-mini-rpg/assets/ {',
    '        return 418;',
    '    }',
    '}',
  ].join('\n');
  try {
    const matchingServer = [
      'server {',
      '    listen 80;',
      '    server_name mcp.edcedc.cn;',
      `    ${beginMarker}`,
      '    gzip_comp_level 1;',
      `    ${endMarker}`,
      '    location ^~ /game/douyin-mini-rpg/assets/ {',
      '        return 404;',
      '    }',
      '    gzip_static on;',
      '    location /keep/ { return 204; }',
      '}',
    ].join('\n');
    const secondMatchingServer = matchingServer.replace('listen 80;', 'listen 81;');
    fs.writeFileSync(configPath, `${unrelatedServer}\n\n${matchingServer}\n\n${secondMatchingServer}\n`);

    const firstRun = runPatcher(configPath);
    assert.equal(firstRun.status, 0, firstRun.stderr);
    const first = fs.readFileSync(configPath, 'utf8');
    const secondRun = runPatcher(configPath);
    assert.equal(secondRun.status, 0, secondRun.stderr);
    const second = fs.readFileSync(configPath, 'utf8');

    assert.equal(second, first);
    assert.ok(second.startsWith(`${unrelatedServer}\n\n`), 'unrelated server bytes changed');
    assert.equal(second.split(beginMarker).length - 1, 3);
    assert.equal(second.match(/server_name mcp\.edcedc\.cn;/g)?.length, 2);
    assert.equal(second.match(/gzip on;/g)?.length, 2);
    assert.match(second, /server_name mcp\.edcedc\.cn;[\s\S]*?gzip on;/);
    assert.match(second, /gzip_static on;/);
    assert.match(second, /location \/keep\//);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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
