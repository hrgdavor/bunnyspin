# Key Management System

Key management is the process of handling cryptographic keys (specifically SSH public and private keys) to ensure secure access to remote systems for both humans (developers) and machines (automation).

## Core Concepts

### System Requirements
To use the `key-manager.js` utility, ensure the following are available:
- **Local**: Bun runtime, `ssh`, `ssh-keygen`.
- **Remote**: SSH server, `sudo` access, and the `acl` package (for `setfacl`).


### Public and Private Key Pairs
- **Private Key**: A secret file kept on the user's local machine or a secure vault. It must never be shared.
- **Public Key**: A non-secret file that is uploaded to remote servers. It is added to the `~/.ssh/authorized_keys` file of the user you want to log in as.

### Authorization Types
- **Developer Users**: Human developers who need remote shell access or the ability to transfer files. Keys are typically managed per developer.
- **Automation Users**: Service accounts or "bots" that run automated scripts, CI/CD pipelines, or background tasks. These keys allow non-interactive, passwordless access.

### Remote Access via SSH
SSH (Secure Shell) uses these key pairs to authenticate users without passwords, which is both more secure and more suitable for automation.

### Shared Visibility and ACLs
When multiple users or application services need to interact with the same set of files (e.g., a shared data directory), standard Unix permissions (User/Group/Other) can sometimes be insufficient. 
**Access Control Lists (ACLs)** allow for more granular permissions, enabling multiple specific users and groups to have read/write access to the same files and directories. For a detailed guide on how to configure these, see the [ACL Documentation](./ACL.md).

### Security & Permissions: Strict Key File Permissions

SSH clients require that private key files have strict permissions to prevent unauthorized access. If the permissions are too broad (e.g., world-readable), the SSH client will refuse to use the key.

#### Linux/macOS
Private keys must be owned by the user and have permissions set to `600` (read/write for owner only).

```bash
chmod 600 ~/.ssh/my_private_key
```

#### Windows
On Windows, the file must be owned by the current user, and all other users (except SYSTEM and Administrators) must be removed from the Access Control List (ACL). You can use PowerShell to fix permissions:

```powershell
$path = "C:\Users\YourUser\.ssh\my_private_key"
# Reset permissions to inherit nothing and grant full control to owner
icacls $path /inheritance:r /grant "$($env:USERNAME):F"
```

#### Example Error
If the permissions are incorrect, you will see an error similar to this:

```text
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@         WARNING: UNPROTECTED PRIVATE KEY FILE!          @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
Permissions 0644 for '/root/.ssh/somekey' are too open.
It is required that your private key files are NOT accessible by others.
This private key will be ignored.
Load key "/root/.ssh/somekey": bad permissions
```

## Key Management Workflow
1. **Generation**: Create a new key pair using tools like `ssh-keygen`.
2. **Distribution**: Upload the public key to the target server.
3. **Configuration**: Create the necessary users and groups on the remote host.
4. **Permissioning**: Apply ACLs to shared resources to ensure the right users and applications can see and modify the files.

## CLI Usage

The `key-manager.js` utility provides several commands to automate these steps:

| Command                            | Description                                                   |
| ---------------------------------- | ------------------------------------------------------------- |
| `create <name>`                    | Generates a new local SSH key pair in the `.keys/` directory. |
| `setup-local <luser> <key>`        | Sets up a local user with the specified private key.          |
| `configure-ssh <lu> <ha> <ru> <k>` | Adds a Host entry to the local user's SSH config.             |
| `setup <host> <user> <group>`      | Creates a user and group on a remote host.                    |
| `authorize <host> <user> <key>`    | Uploads and authorizes a public key for a remote user.        |
| `share <host> <path> <u1> <u2>`    | Configures ACLs for shared access on a remote path.           |

### Example: Automation User Setup
To set up a local user `jenkins` to connect to `fgks-dev` as the remote user `deploy`:

```sh
# 1. Create the key
bun src/apps/key-manager/key-manager.js create key1

# 2. Setup local user 'jenkins' with this key
bun src/apps/key-manager/key-manager.js setup-local jenkins key1

# 3. Configure local SSH alias so jenkins can just run 'ssh fgks-dev'
bun src/apps/key-manager/key-manager.js configure-ssh jenkins fgks-dev deploy key1

# 4. Authorize the key for 'deploy' on the remote server
bun src/apps/key-manager/key-manager.js authorize fgks-dev deploy key1
```
