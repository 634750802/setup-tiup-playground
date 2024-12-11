import { checkClusterStatus, checkTiUPVersion, installTiUP, startCluster, tiup } from "./utils.js";
import core from '@actions/core';


let tiupVersion;
const tiupBinPath = await installTiUP()
core.exportVariable('TIUP_PATH', `${tiupBinPath}`);
core.info(`Installed tiup at: ${tiup()}`)
tiupVersion = await checkTiUPVersion();

if (!tiupVersion) {
  throw new Error('cannot install tiup');
}

core.info(`Using tiup: ${tiupVersion}`);

const version = core.getInput('version');
const db = parseInt(core.getInput('db'));
const kv = parseInt(core.getInput('kv'));
const pb = parseInt(core.getInput('pb'));
const tiflash = parseInt(core.getInput('tiflash'));
const clusterId = core.getInput('cluster-id');
const timeout = parseInt(core.getInput('timeout') || '60');

startCluster({
  version,
  tag: clusterId,
  db,
  kv,
  pb,
  tiflash,
});

core.info(`Waiting tiup playground start (cluster-id: ${clusterId})`)

let up = false;

for (let i = 1; i <= timeout; i++) {
  up = await checkClusterStatus(clusterId);
  if (up) {
    break
  }
  await new Promise(resolve => setTimeout(resolve, 1000));
}

if (!up) {
  core.error(`tiup playground timeout`)
  process.exit(1)
} else {
  core.info(`tiup playground started`)
  process.exit(0)
}

