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
   * Gets the home directory for a user.
   * @param {string} username 
   * @param {string|null} host - If provided, checks on remote host.
   */
  async getUserHome(username, host = null) {
    const cmd = `getent passwd ${username} | cut -d: -f6`;
    let home = "";

    if (host) {
      const { stdout } = await this.remoteExec(host, cmd);
      home = stdout.trim();
    } else {
      const proc = Bun.spawn(["sh", "-c", cmd], { stdout: "pipe" });
      home = (await new Response(proc.stdout).text()).trim();

      // Fallback for some systems where getent might be missing or incomplete
      if (!home) {
        const fallbackProc = Bun.spawn(["sh", "-c", `eval echo ~${username}`], { stdout: "pipe" });
        home = (await new Response(fallbackProc.stdout).text()).trim();
      }
    }

    if (!home || home === `~${username}`) {
      throw new Error(`Could not resolve home directory for user "${username}"${host ? ` on ${host}` : " locally"}.`);
    }
    return home;
  }

  /**
   * Resolves effective SSH config for a host alias using ssh -G.
   * @param {string} alias 
   */
  async resolveHostInfo(alias) {
    try {
      const proc = Bun.spawn(["ssh", "-G", alias], { stdout: "pipe" });
      const output = await new Response(proc.stdout).text();
      const info = {};
      for (const line of output.split("\n")) {
        const [key, ...value] = line.trim().split(/\s+/);
        if (key && value.length > 0) info[key.toLowerCase()] = value.join(" ");
      }
      return info;
    } catch (e) {
      return null;
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
      console.warn(`Key ${name} already exists. Skipping generation. ${keyPath}`);
    } else {
      console.log(`Generating key pair: ${name} to ${keyPath}`);
      const proc = Bun.spawn(["ssh-keygen", "-t", "ed25519", "-f", keyPath, "-N", "", "-C", `${name}@bunnyspin`], {
        stderr: "pipe",
      });
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        if (stderr.trim()) console.error(stderr);
        const err = new Error(`Failed with exit code ${exitCode}`);
        err.stderr = stderr;
        throw err;
      }
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
    const proc = Bun.spawn(["ssh", "-T", "-o", "RemoteCommand=none", host, command], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      if (stderr.trim()) {
        console.error(`--- SSH Error Output ---`);
        console.error(stderr);
        console.error(`-----------------------`);
      }
      const err = new Error(`Failed with exit code ${exitCode}`);
      err.stderr = stderr;
      err.stdout = stdout;
      throw err;
    }
    return { stdout, stderr };
  }

  /**
   * Creates a user and group on a remote host.
   * @param {string} host - Remote host (with sudo access).
   * @param {string} username 
   * @param {string} group 
   */
  async setupRemoteUser(host, username, group) {
    console.log(`Setting up user ${username} and group ${group} on ${host}`);
    await this.remoteExec(host, `sudo groupadd -f ${group}`);
    await this.remoteExec(host, `sudo useradd -m -g ${group} -s /bin/bash ${username} || true`);
    
    const home = await this.getUserHome(username, host);
    const sshDir = `${home}/.ssh`;

    const commands = [
      `sudo mkdir -p ${sshDir}`,
      `sudo chmod 700 ${sshDir}`,
      `sudo chown ${username}:${group} ${sshDir}`
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
    const home = await this.getUserHome(username, host);
    const authFile = `${home}/.ssh/authorized_keys`;
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

  /**
   * Configures a local user with a private key.
   * @param {string} localUser - Local username to configure.
   * @param {string} keyName - Name of the key in .keys/
   */
  async setupLocalUser(localUser, keyName) {
    console.log(`Configuring local user ${localUser} with key ${keyName}`);
    
    // Ensure user exists first
    try {
      await $`id -u ${localUser}`.quiet();
    } catch (e) {
      await $`sudo useradd -m -s /bin/bash ${localUser}`.quiet();
    }
    
    const home = await this.getUserHome(localUser);
    console.log(`Resolved local home for ${localUser}: ${home}`);
    const keyPath = join(this.keyDir, keyName);
    const userSshDir = join(home, ".ssh");
    const targetKeyPath = join(userSshDir, `id_ed25519_${keyName}`);

    if (!existsSync(keyPath)) {
      throw new Error(`Key file not found: ${keyPath}`);
    }

    const commands = [
      `sudo mkdir -p ${userSshDir}`,
      `sudo cp ${keyPath} ${targetKeyPath}`,
      `sudo chown -R ${localUser}:${localUser} ${userSshDir}`,
      `sudo chmod 700 ${userSshDir}`,
      `sudo chmod 600 ${targetKeyPath}`
    ];

    for (const cmd of commands) {
      // Using sh -c to handle sudo and complex strings locally
      await $`sh -c ${cmd}`.quiet();
    }
  }

  /**
   * Configures a Host entry in a local user's SSH config.
   * @param {string} localUser - Local username.
   * @param {string} hostAlias - The host alias (e.g., fgks-dev).
   * @param {string} remoteUser - The remote username.
   * @param {string} keyName - Name of the key in .keys/
   */
  async configureLocalSsh(localUser, hostAlias, remoteUser, keyName) {
    console.log(`Configuring SSH config for local user ${localUser} (alias: ${hostAlias})`);
    
    // Resolve existing host info (HostName, Port, etc.)
    const hostInfo = await this.resolveHostInfo(hostAlias);
    const hostName = hostInfo?.hostname || hostAlias;
    const port = hostInfo?.port || "22";
    
    const home = await this.getUserHome(localUser);
    console.log(`Resolved local home for ${localUser}: ${home}`);
    const userSshDir = join(home, ".ssh");
    const configFile = join(userSshDir, "config");
    const targetKeyPath = join(userSshDir, `id_ed25519_${keyName}`);

    const configEntry = `\nHost ${hostAlias}\n  HostName ${hostName}\n  Port ${port}\n  User ${remoteUser}\n  IdentityFile ${targetKeyPath}\n  StrictHostKeyChecking accept-new\n  LogLevel ERROR\n`;

    // Ensure the config file exists and append the entry
    const command = `sudo touch ${configFile} && echo "${configEntry}" | sudo tee -a ${configFile} > /dev/null && sudo chown ${localUser}:${localUser} ${configFile} && sudo chmod 600 ${configFile}`;
    await $`sh -c ${command}`.quiet();

    // Pre-scan host key to avoid interactive prompts
    console.log(`Scanning host key for ${hostAlias} (${hostName}:${port})...`);
    const knownHostsFile = join(userSshDir, "known_hosts");
    const scanCmd = `ssh-keyscan -p ${port} ${hostAlias},${hostName} 2>/dev/null | sudo tee -a ${knownHostsFile} > /dev/null && sudo chown ${localUser}:${localUser} ${knownHostsFile} && sudo chmod 644 ${knownHostsFile}`;
    await $`sh -c ${scanCmd}`.quiet();
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
    } else if (command === "setup-local") {
      const [localUser, keyName] = args.slice(1);
      await manager.setupLocalUser(localUser, keyName);
    } else if (command === "configure-ssh") {
      const [localUser, hostAlias, remoteUser, keyName] = args.slice(1);
      await manager.configureLocalSsh(localUser, hostAlias, remoteUser, keyName);
    } else {
      console.log("Usage: key-manager <command> [args]");
      console.log("Commands:");
      console.log("  create <name>                   - Create a local key pair");
      console.log("  setup <host> <user> <group>    - Create remote user/group");
      console.log("  authorize <host> <user> <key>  - Upload key to remote user");
      console.log("  share <host> <path> <u1> <u2>  - Set ACLs for shared access");
      console.log("  setup-local <luser> <key>      - Configure local user with key");
      console.log("  configure-ssh <luser> <host-alias> <ruser> <key> - Add Host entry to local user config");
    }
  } catch (err) {
    console.error("Error:", err.message);
    if (err.stderr) {
      console.error(err.stderr.toString());
    }
  }
}

export { KeyManager };
