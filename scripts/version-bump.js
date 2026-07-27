#!/usr/bin/env node
// COS version bump script
const fs = require('fs');

const root = fs.readFileSync('package.json', 'utf8');
const pkg = JSON.parse(root);
const [M, m, P] = pkg.version.split('.').map(Number);
pkg.version = `${M}.${m}.${P + 1}`;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

// Update sub-packages
const pkgs = ['graph', 'observability', 'visualization', 'wasm'];
for (const p of pkgs) {
  try {
    const path = `packages/${p}/package.json`;
    const sub = JSON.parse(fs.readFileSync(path, 'utf8'));
    sub.version = pkg.version;
    fs.writeFileSync(path, JSON.stringify(sub, null, 2) + '\n');
    console.log(`  Updated ${path} → ${pkg.version}`);
  } catch {}
}

console.log(`\nVersion bumped to ${pkg.version}`);
console.log('Run: git add -A && git commit -m "chore(release): v' + pkg.version + '"');