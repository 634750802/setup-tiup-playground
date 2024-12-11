import core from "@actions/core";
import { checkClusterStatus, stopCluster } from "./utils.js";

const tiupBinPath = core.getState('tiup-bin-path') || 'tiup';
const clusterId = core.getInput('cluster-id')

await stopCluster(tiupBinPath, clusterId);

let up = true;

for (let i = 1; i <= 30; i++) {
  up = await checkClusterStatus(tiupBinPath, clusterId);
  if (!up) {
    break
  }
  await new Promise(resolve => setTimeout(resolve, 1000));
}

if (up) {
  core.error(`tiup playground shutdown timeout`)
  process.exit(1)
} else {
  core.info(`tiup playground stopped`)
  process.exit(0)
}