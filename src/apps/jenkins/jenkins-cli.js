import * as jenkins from "./jenkins-lib.js";
import { $ } from "bun";

const backupPath = await jenkins.createBackupDir();

try {
  console.log(`Current Version: ${await jenkins.getVersion()}`);

  await jenkins.stopJenkins();
  await jenkins.performBackup(backupPath);

  console.log("Running APT upgrade...");
  await $`apt-get update && apt-get install --only-upgrade jenkins -y`;

  await jenkins.startJenkins();

  console.log("Waiting 20s for warm-up...");
  await new Promise(r => setTimeout(r, 20000));

  if (!await jenkins.healthCheck()) throw new Error("Health check failed");

  console.log("🚀 Update successful!");

  // Cleanup old backups only after a successful update
  jenkins.cleanupBackups(30);

} catch (err) {
  console.error(`Error: ${err.message}`);
  await jenkins.revert(backupPath);
  process.exit(1);
}
