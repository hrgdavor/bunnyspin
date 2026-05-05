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

## Key Management Workflow
1. **Generation**: Create a new key pair using tools like `ssh-keygen`.
2. **Distribution**: Upload the public key to the target server.
3. **Configuration**: Create the necessary users and groups on the remote host.
4. **Permissioning**: Apply ACLs to shared resources to ensure the right users and applications can see and modify the files.
