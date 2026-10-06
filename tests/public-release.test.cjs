"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
function files(dir = ROOT) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e =>
    e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
test('public release excludes the portal session capture but retains explicit provenance', () => {
  const x = JSON.parse(fs.readFileSync(path.join(ROOT, 'verification/public-release-exclusions.json')));
  assert.equal(x.excludedFiles.length, 1);
  for (const e of x.excludedFiles) {
    assert.equal(fs.existsSync(path.join(ROOT, e.path)), false);
    assert.match(e.sha256, /^[a-f0-9]{64}$/);
    assert.equal(e.runtimeRequired, false);
  }
  const preview = JSON.parse(fs.readFileSync(path.join(ROOT, 'matrix/data/source/jeonju-wind-preview-20241006.json')));
  assert.equal(preview.records.length, 10);
  assert.ok(fs.existsSync(path.join(ROOT, 'matrix/data/source/user-upload/OBS_ASOS_MI_20261006125115.csv')));
});
test('release has no detected credential values or private machine paths', () => {
  const patterns = [
    /;jsessionid=[A-Za-z0-9_.-]{8,}/i,
    /[?&](?:authKey|api_key|access_token)=[A-Za-z0-9_+%.-]{12,}/i,
    /\b(?:ghp|gho|github_pat)_[A-Za-z0-9_]{20,}/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /(?:\/Users\/|\/home\/|\/workspace\/|\/mnt\/data\/)[A-Za-z0-9_]/
  ];
  for (const f of files()) {
    if (!/\.(?:html|js|cjs|json|csv|md|txt|py|css|svg)$/i.test(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const pattern of patterns) assert.equal(pattern.test(text), false, `${path.relative(ROOT, f)}: credential/path indicator`);
  }
});
test('GitHub Pages entry and release safeguards are bundled', () => {
  for (const f of ['index.html', '.nojekyll', '.gitignore', 'PUBLIC_RELEASE.md', 'SOURCES.md', 'data/ADMIN-LICENSE.txt'])
    assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  assert.match(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8'), /source\/raw\/\*\.html/);
});
