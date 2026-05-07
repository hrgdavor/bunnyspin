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
    this.dryRun = config.dryRun || false;
    this.ensureDir(this.keyDir);
  }

  /**
   * Ensures a local directory exists, respecting dry run.
   * @param {string} path 
   */
  ensureDir(path) {
    if (!existsSync(path)) {
      console.log(`mkdir -p ${path}`);
      if (!this.dryRun) {
        mkdirSync(path, { recursive: true });
      }
    }
  }

  /**
   * Logs and optionally executes a local command.
   * @param {string} description 
   * @param {string|string[]} cmd - Command string or array of args.
   */
  async localExec(description, cmd) {
    if (description) console.log(`# ${description}`);
    const fullCmd = Array.isArray(cmd) ? cmd.join(" ") : cmd;
    console.log(fullCmd);

    if (this.dryRun) return { stdout: "", stderr: "" };

    try {
      const proc = Array.isArray(cmd) ? Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" }) : Bun.spawn(["sh", "-c", cmd], { stdout: "pipe", stderr: "pipe" });
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const err = new Error(`Local command failed with exit code ${exitCode}`);
        err.stderr = stderr;
        err.stdout = stdout;
        throw err;
      }
      return { stdout, stderr };
    } catch (err) {
      throw err;
    }
  }

  /**
   * Executes a command on a remote host via SSH.
   * @param {string} host - Remote host (e.g., user@host).
   * @param {string} command - Command to execute.
   * @param {object} options - Options for execution.
   */
  async remoteExec(host, command, options = {}) {
    const isQuiet = options.quiet || false;
    const sshCmd = ["ssh", "-T", "-o", "RemoteCommand=none", host, command];

    if (!isQuiet) {
      console.log(`# Executing on ${host}`);
      console.log(`ssh -T -o "RemoteCommand=none" ${host} ${JSON.stringify(command)}`);
    }

    if (this.dryRun && !options.force) {
      return { stdout: "", stderr: "" };
    }

    const proc = Bun.spawn(sshCmd, {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      if (!isQuiet && stderr.trim()) {
        console.error(`--- SSH Error Output ---`);
        console.error(stderr);
        console.error(`-----------------------`);
      }
      const err = new Error(`SSH failed with exit code ${exitCode}`);
      err.stderr = stderr;
      err.stdout = stdout;
      throw err;
    }
    return { stdout, stderr };
  }

  /**
   * Gets the home directory for a user.
   * @param {string} username 
   * @param {string|null} host - If provided, checks on remote host.
   */
  async getUserHome(username, host = null) {
    const cmd = `getent passwd ${username} | cut -d: -f6`;
    let home = "";

    try {
      if (host) {
        // Force execution even in dry run to get correct paths for output
        const { stdout } = await this.remoteExec(host, cmd, { quiet: true, force: true });
        home = stdout.trim();
      } else {
        const proc = Bun.spawn(["sh", "-c", cmd], { stdout: "pipe" });
        home = (await new Response(proc.stdout).text()).trim();

        if (!home) {
          const fallbackProc = Bun.spawn(["sh", "-c", `eval echo ~${username}`], { stdout: "pipe" });
          home = (await new Response(fallbackProc.stdout).text()).trim();
        }
      }
    } catch (e) {
      // Fallback if user doesn't exist yet
      home = `/home/${username}`;
    }

    if (!home || home === `~${username}`) {
      home = `/home/${username}`;
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
      console.warn(`# Key ${name} already exists. Skipping generation. ${keyPath}`);
    } else {
      const cmd = ["ssh-keygen", "-t", "ed25519", "-f", keyPath, "-N", "", "-C", `${name}@bunnyspin`];
      await this.localExec(`Generating key pair: ${name}`, cmd);
    }

    if (this.dryRun) return { publicKey: "DRY_RUN_PUBLIC_KEY", privateKeyPath: keyPath };

    const publicKey = await Bun.file(`${keyPath}.pub`).text();
    return {
      publicKey: publicKey.trim(),
      privateKeyPath: keyPath
    };
  }

  /**
   * Creates a user and group on a remote host.
   * @param {string} host - Remote host (with sudo access).
   * @param {string} username 
   * @param {string} group 
   */
  async setupRemoteUser(host, username, group) {
    await this.remoteExec(host, `sudo groupadd -f ${group}`);
    await this.remoteExec(host, `sudo useradd -m -g ${group} -s /bin/bash ${username} || true`);

    const home = await this.getUserHome(username, host);
    const sshDir = `${home}/.ssh`;

    const commands = [
      [`sudo mkdir -p ${sshDir}`, `Ensuring .ssh directory for ${username} on ${host}`],
      [`sudo chmod 700 ${sshDir}`, `Setting permissions for .ssh directory`],
      [`sudo chown ${username}:${group} ${sshDir}`, `Setting ownership for .ssh directory`]
    ];

    for (const [cmd, desc] of commands) {
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
    // Ensure ACL is installed and apply it
    let aclCmd = `sudo setfacl -R -m `;
    const entries = users.map(u => `u:${u}:${permissions}`).join(",");
    const defaultEntries = users.map(u => `d:u:${u}:${permissions}`).join(",");

    await this.remoteExec(host, `${aclCmd}${entries} ${path}`);
    await this.remoteExec(host, `${aclCmd}${defaultEntries} ${path}`);
  }

  /**
   * Configures a local user with a private key.
   * @param {string} localUser - Local username to configure.
   * @param {string} keyName - Name of the key in .keys/
   */
  async setupLocalUser(localUser, keyName) {
    // Ensure user exists first
    try {
      await this.localExec(`Checking if user ${localUser} exists`, `id -u ${localUser}`);
    } catch (e) {
      await this.localExec(`Creating local user ${localUser}`, `sudo useradd -m -s /bin/bash ${localUser}`);
    }

    const home = await this.getUserHome(localUser);
    const keyPath = join(this.keyDir, keyName);
    const userSshDir = join(home, ".ssh");
    const targetKeyPath = join(userSshDir, `id_ed25519_${keyName}`);

    await this.localExec(`Ensuring .ssh directory for ${localUser}`, `sudo mkdir -p ${userSshDir}`);
    await this.localExec(`Deploying private key ${keyName} to ${localUser}`, `sudo cp ${keyPath} ${targetKeyPath}`);
    await this.localExec(`Setting ownership for .ssh directory`, `sudo chown -R ${localUser}:${localUser} ${userSshDir}`);
    await this.localExec(`Setting permissions for .ssh directory`, `sudo chmod 700 ${userSshDir}`);
    await this.localExec(`Setting permissions for private key`, `sudo chmod 600 ${targetKeyPath}`);
  }

  /**
   * Configures a Host entry in a local user's SSH config.
   * @param {string} localUser - Local username.
   * @param {string} hostAlias - The host alias (e.g., srv-dev).
   * @param {string} remoteUser - The remote username.
   * @param {string} keyName - Name of the key in .keys/
   */
  async configureLocalSsh(localUser, hostAlias, remoteUser, keyName) {
    // Resolve existing host info (HostName, Port, etc.)
    const hostInfo = await this.resolveHostInfo(hostAlias);
    const hostName = hostInfo?.hostname || hostAlias;
    const port = hostInfo?.port || "22";

    const home = await this.getUserHome(localUser);
    const userSshDir = join(home, ".ssh");
    const configFile = join(userSshDir, "config");
    const targetKeyPath = join(userSshDir, `id_ed25519_${keyName}`);

    const configEntry = `\nHost ${hostAlias}\n  HostName ${hostName}\n  Port ${port}\n  User ${remoteUser}\n  IdentityFile ${targetKeyPath}\n  StrictHostKeyChecking accept-new\n  LogLevel ERROR\n`;

    const command = `sudo touch ${configFile} && echo "${configEntry}" | sudo tee -a ${configFile} > /dev/null && sudo chown ${localUser}:${localUser} ${configFile} && sudo chmod 600 ${configFile}`;
    await this.localExec(`Configuring SSH config for ${localUser} (alias: ${hostAlias})`, command);

    const knownHostsFile = join(userSshDir, "known_hosts");
    const scanCmd = `ssh-keyscan -p ${port} ${hostAlias},${hostName} 2>/dev/null | sudo tee -a ${knownHostsFile} > /dev/null && sudo chown ${localUser}:${localUser} ${knownHostsFile} && sudo chmod 644 ${knownHostsFile}`;
    await this.localExec(`Scanning host key for ${hostAlias}`, scanCmd);
  }
}

// CLI entry point (example usage)
if (import.meta.main) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("-d");
  const filteredArgs = args.filter(a => a !== "--dry-run" && a !== "-d");

  const manager = new KeyManager({ dryRun });
  const command = filteredArgs[0];

  try {
    if (command === "create") {
      const name = filteredArgs[1];
      await manager.createKeyPair(name);
    } else if (command === "setup") {
      const [host, user, group] = filteredArgs.slice(1);
      await manager.setupRemoteUser(host, user, group);
    } else if (command === "authorize") {
      const [host, user, keyName] = filteredArgs.slice(1);
      const keyPath = join(manager.keyDir, `${keyName}.pub`);
      let publicKey = "DRY_RUN_PUBLIC_KEY";
      if (!dryRun) {
        publicKey = await Bun.file(keyPath).text();
      }
      await manager.authorizeKey(host, user, publicKey.trim());
    } else if (command === "share") {
      const [host, path, ...users] = filteredArgs.slice(1);
      await manager.setAcl(host, path, users);
    } else if (command === "setup-local") {
      const [localUser, keyName] = filteredArgs.slice(1);
      await manager.setupLocalUser(localUser, keyName);
    } else if (command === "configure-ssh") {
      const [localUser, hostAlias, remoteUser, keyName] = filteredArgs.slice(1);
      await manager.configureLocalSsh(localUser, hostAlias, remoteUser, keyName);
    } else {
      console.log("Usage: key-manager <command> [args] [--dry-run|-d]");
      console.log("Commands:");
      console.log("  create <name>                   - Create a local key pair");
      console.log("  setup <host> <user> <group>    - Create remote user/group");
      console.log("  authorize <host> <user> <key>  - Upload key to remote user");
      console.log("  share <host> <path> <u1> <u2>  - Set ACLs for shared access");
      console.log("  setup-local <luser> <key>      - Configure local user with key");
      console.log("  configure-ssh <luser> <host-alias> <ruser> <key> - Add Host entry to local user config");
    }
  } catch (err) {
    if (!dryRun) {
      console.error("Error:", err.message);
      if (err.stderr) {
        console.error(err.stderr.toString());
      }
    }
  }
}

export { KeyManager };
