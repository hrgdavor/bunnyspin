#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Key Manager Utility
 * Assists with SSH key creation, remote user setup, and ACL management.
 */

class KeyManager {
  constructor(config = {}) {
    this.keyDir = config.keyDir || join(process.cwd(), ".keys");
    if (!existsSync(this.keyDir)) {
      mkdirSync(this.keyDir, { recursive: true });
    }
  }

  /**
   * Generates a new SSH key pair locally.
   * @param {string} name - Base name for the key files.
   * @returns {Promise<{publicKey: string, privateKeyPath: string}>}
   */
  async createKeyPair(name) {
    const keyPath = join(this.keyDir, name);
    if (existsSync(keyPath)) {
      console.warn(`Key ${name} already exists. Skipping generation.`);
    } else {
      console.log(`Generating key pair: ${name}`);
      await $`ssh-keygen -t ed25519 -f ${keyPath} -N "" -C "${name}@bunnyspin"`.quiet();
    }
    
    const publicKey = await Bun.file(`${keyPath}.pub`).text();
    return {
      publicKey: publicKey.trim(),
      privateKeyPath: keyPath
    };
  }

  /**
   * Executes a command on a remote host via SSH.
   * @param {string} host - Remote host (e.g., user@host).
   * @param {string} command - Command to execute.
   */
  async remoteExec(host, command) {
    console.log(`Executing on ${host}: ${command}`);
    return await $`ssh ${host} "${command}"`.quiet();
  }

  /**
   * Creates a user and group on a remote host.
   * @param {string} host - Remote host (with sudo access).
   * @param {string} username 
   * @param {string} group 
   */
  async setupRemoteUser(host, username, group) {
    console.log(`Setting up user ${username} and group ${group} on ${host}`);
    const commands = [
      `sudo groupadd -f ${group}`,
      `sudo useradd -m -g ${group} -s /bin/bash ${username} || true`,
      `sudo mkdir -p /home/${username}/.ssh`,
      `sudo chmod 700 /home/${username}/.ssh`,
      `sudo chown ${username}:${group} /home/${username}/.ssh`
    ];
    
    for (const cmd of commands) {
      await this.remoteExec(host, cmd);
    }
  }

  /**
   * Uploads and authorizes a public key for a remote user.
   * @param {string} host - Remote host.
   * @param {string} username - Remote user.
   * @param {string} publicKey - Public key content.
   */
  async authorizeKey(host, username, publicKey) {
    console.log(`Authorizing key for ${username} on ${host}`);
    const authFile = `/home/${username}/.ssh/authorized_keys`;
    const command = `echo "${publicKey}" | sudo tee -a ${authFile} > /dev/null && sudo chmod 600 ${authFile} && sudo chown ${username} ${authFile}`;
    await this.remoteExec(host, command);
  }

  /**
   * Configures ACLs for a path to allow shared access.
   * @param {string} host - Remote host.
   * @param {string} path - Target directory or file.
   * @param {string[]} users - List of users to grant access to.
   * @param {string} permissions - e.g., "rwx"
   */
  async setAcl(host, path, users, permissions = "rwx") {
    console.log(`Setting ACLs on ${path} for ${users.join(", ")}`);
    // Ensure ACL is installed and apply it
    let aclCmd = `sudo setfacl -R -m `;
    const entries = users.map(u => `u:${u}:${permissions}`).join(",");
    const defaultEntries = users.map(u => `d:u:${u}:${permissions}`).join(",");
    
    // Apply to current files and set defaults for new files
    await this.remoteExec(host, `${aclCmd}${entries} ${path}`);
    await this.remoteExec(host, `${aclCmd}${defaultEntries} ${path}`);
  }
}

// CLI entry point (example usage)
if (import.meta.main) {
  const manager = new KeyManager();
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === "create") {
      const name = args[1];
      await manager.createKeyPair(name);
    } else if (command === "setup") {
      const [host, user, group] = args.slice(1);
      await manager.setupRemoteUser(host, user, group);
    } else if (command === "authorize") {
      const [host, user, keyName] = args.slice(1);
      const keyPath = join(manager.keyDir, `${keyName}.pub`);
      const publicKey = await Bun.file(keyPath).text();
      await manager.authorizeKey(host, user, publicKey.trim());
    } else if (command === "share") {
      const [host, path, ...users] = args.slice(1);
      await manager.setAcl(host, path, users);
    } else {
      console.log("Usage: key-manager <command> [args]");
      console.log("Commands:");
      console.log("  create <name>                   - Create a local key pair");
      console.log("  setup <host> <user> <group>    - Create remote user/group");
      console.log("  authorize <host> <user> <key>  - Upload key to remote user");
      console.log("  share <host> <path> <u1> <u2>  - Set ACLs for shared access");
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

export { KeyManager };
