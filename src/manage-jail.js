// apt-get-install debootstrap rush
// inotify-tools for triggering restart
// https://share.google/aimode/sr3AX3x5zDGgJISWA
//
import { $ } from "bun";
import { existsSync, appendFileSync, writeFileSync } from "node:fs";

const JAIL_ROOT = "/var/lib/dev_jail";
const DEV_GROUP = "developers";

/**
 * Initializes the master jail if it doesn't exist.
 * Uses debootstrap to create a minimal Ubuntu environment.
 */
async function setupJail() {
  if (!existsSync(JAIL_ROOT)) {
    console.log("Building master jail...");
    await $`sudo mkdir -p ${JAIL_ROOT}`;
    await $`sudo debootstrap --variant=minbase focal ${JAIL_ROOT}`;
    // Install rush inside the jail for restriction
    await $`sudo chroot ${JAIL_ROOT} apt-get update`;
    await $`sudo chroot ${JAIL_ROOT} apt-get install -y rush rsync openssh-client`;
  }
}

/**
 * Adds a new restricted developer user.
 */
 async function addUser(username, sshPublicKey) {
   const userJail = `/var/jails/${username}`;
   const realData = `/home/${username}/data`;

   // 1. Create the Jail Structure
   await $`sudo mkdir -p ${userJail}/{bin,lib,lib64,usr/bin,etc,data}`;
   await $`sudo mkdir -p ${realData}`;

   // 2. Map System Binaries (Read-Only)
   // This lets them use rsync/scp without copying files
   const mounts = ["/bin", "/lib", "/lib64", "/usr/bin"];
   for (const dir of mounts) {
     await $`sudo mount --bind ${dir} ${userJail}${dir}`;
     await $`sudo mount -o remount,ro,bind ${userJail}${dir}`;
   }

   // 3. Map the Project Folder (Writeable)
   await $`sudo mount --bind ${realData} ${userJail}/data`;

   // 4. Update SSH Config (Manual or automated)
   // Each user gets their own root
   const sshSnippet = `
 Match User ${username}
     ChrootDirectory ${userJail}
     ForceCommand internal-sftp
 `;
   console.log("Add this to /etc/ssh/sshd_config:", sshSnippet);
 }

/**
 * Removes a user and cleans up mounts.
 */
async function removeUser(username) {
  const jailHome = `${JAIL_ROOT}/home/${username}`;

  console.log(`🗑️ Removing user: ${username}`);
  try {
    await $`sudo umount ${jailHome}`;
  } catch (e) {
    console.error("Warning: Could not unmount, might already be unmounted.");
  }

  await $`sudo deluser --remove-home ${username}`;
  await $`sudo rm -rf ${jailHome}`;
  console.log(`✅ User ${username} removed. (Note: Manually clean /etc/fstab if needed)`);
}

// Simple CLI Router
const [command, user, data] = Bun.argv.slice(2);

if (command === "add" && user && data) {
  await addUser(user, data);
} else if (command === "remove" && user) {
  await removeUser(user);
} else {
  console.log("Usage:");
  console.log('  bun manage-jail.ts add <username> "<ssh-public-key>"');
  console.log("  bun manage-jail.ts remove <username>");
}
