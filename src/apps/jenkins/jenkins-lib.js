import { $ } from "bun";
import { existsSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";

export const CONFIG = {
  JENKINS_WAR: "/usr/share/java/jenkins.war",
  JENKINS_HOME: "/var/lib/jenkins",
  BACKUP_BASE: "/opt/jenkins_backups",
};

/**
 * Deletes backup folders older than X days
 */
export function cleanupBackups(daysOld = 30) {
  if (!existsSync(CONFIG.BACKUP_BASE)) return;

  const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  const folders = readdirSync(CONFIG.BACKUP_BASE);

  console.log(`Cleaning up backups older than ${daysOld} days...`);

  for (const folder of folders) {
    const fullPath = join(CONFIG.BACKUP_BASE, folder);
    const stats = statSync(fullPath);

    if (stats.isDirectory() && stats.mtimeMs < cutoff) {
      console.log(`Deleting old backup: ${folder}`);
      rmSync(fullPath, { recursive: true, force: true });
    }
  }
}

export async function getVersion() {
  try {
    const version = await $`java -jar ${CONFIG.JENKINS_WAR} --version`.text();
    return version.trim();
  } catch (e) { return "unknown"; }
}

export async function createBackupDir() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(CONFIG.BACKUP_BASE, timestamp);
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
  return path;
}

export async function stopJenkins() { await $`systemctl stop jenkins`; }
export async function startJenkins() { await $`systemctl start jenkins`; }

export async function performBackup(backupDir) {
  console.log(`Backing up to ${backupDir}...`);
  await $`cp ${CONFIG.JENKINS_WAR} ${backupDir}/jenkins.war`;
  await $`tar -czf ${backupDir}/jenkins_home.tar.gz ${CONFIG.JENKINS_HOME}`;
}

export async function revert(backupDir) {
  console.error("\n⚠️ Reverting to previous state...");
  await stopJenkins();
  await $`cp ${backupDir}/jenkins.war ${CONFIG.JENKINS_WAR}`;
  await $`rm -rf ${CONFIG.JENKINS_HOME}/*`;
  await $`tar -xzf ${backupDir}/jenkins_home.tar.gz -C /`;
  await startJenkins();
}

export async function healthCheck(url = "http://localhost:8080/login") {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch { return false; }
}
