'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const versionFile = path.join(root, 'app-version.json');

const cliVersion = process.argv[2];
const cliDate = process.argv[3];

let data;
if (cliVersion) {
  const releaseDate = cliDate || new Date().toISOString().slice(0, 10);
  data = { version: cliVersion, releaseDate };
  fs.writeFileSync(versionFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`app-version.json actualizado: ${cliVersion} (${releaseDate})`);
} else {
  data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
}

const { version, releaseDate } = data;

if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('app-version.json: "version" debe ser semver (p. ej. 4.0.2)');
  process.exit(1);
}
if (!releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
  console.error('app-version.json: "releaseDate" debe ser YYYY-MM-DD');
  process.exit(1);
}

const versionJs = `// Generado por npm run sync-version — no editar. Fuente: app-version.json
/* eslint-disable no-var */
var APP_VERSION = '${version}';
var APP_RELEASE_DATE = '${releaseDate}';
`;

fs.writeFileSync(path.join(root, 'www', 'version.js'), versionJs, 'utf8');

const configPath = path.join(root, 'config.xml');
let configXml = fs.readFileSync(configPath, 'utf8');
configXml = configXml.replace(
  /(<widget[^>]*\sversion=")[^"]*(")/,
  `$1${version}$2`
);
fs.writeFileSync(configPath, configXml, 'utf8');

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

const manifestPath = path.join(root, 'www', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
delete manifest._comment;
delete manifest.version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`Versión sincronizada: ${version} (${releaseDate})`);
