#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const VALID_BUMPS = new Set(["patch", "minor", "major"]);
const bumpType = process.env.VERSION_BUMP || process.argv[2] || "patch";
const explicitVersion = process.env.VERSION;

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Unsupported package version "${version}". Expected x.y.z.`);
  }
  return match.slice(1).map(Number);
}

function nextVersion(current) {
  if (explicitVersion) {
    parseVersion(explicitVersion);
    return explicitVersion;
  }

  if (!VALID_BUMPS.has(bumpType)) {
    throw new Error(`Unsupported VERSION_BUMP "${bumpType}". Use patch, minor, or major.`);
  }

  const [major, minor, patch] = parseVersion(current);
  switch (bumpType) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
}

const packageJson = await readJson("package.json");
const currentVersion = packageJson.version;
const version = nextVersion(currentVersion);

packageJson.version = version;
await writeJson("package.json", packageJson);

const packageLock = await readJson("package-lock.json");
packageLock.version = version;
if (packageLock.packages?.[""]) {
  packageLock.packages[""].version = version;
}
await writeJson("package-lock.json", packageLock);

console.log(`${currentVersion} -> ${version}`);
