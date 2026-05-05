# Access Control Lists (ACL) in Key Management

Standard Unix permissions (User, Group, Others) are often insufficient for complex automation and multi-user environments. Access Control Lists (ACLs) provide a more granular way to manage file and directory permissions.

## How ACLs Work

While standard permissions allow you to define one owner, one group, and "others," ACLs allow you to:
- Grant permissions to **multiple specific users**.
- Grant permissions to **multiple specific groups**.
- Set **default permissions** for new files created within a directory.

### Key Concepts

#### Access ACLs vs. Default ACLs
- **Access ACLs**: These apply to the file or directory itself. They control who can read, write, or execute that specific object right now.
- **Default ACLs**: These can only be set on **directories**. They do not affect access to the directory itself; instead, they define the ACLs that will be automatically applied to any **new files or subdirectories** created inside that directory.

#### Inheritance for New Files
When a new file is created in a directory with Default ACLs:
1. The file's Access ACL is set to the directory's Default ACL.
2. The permissions are still masked by the creator's requested permissions (e.g., from `umask` or the `touch`/`mkdir` command), but the ACL ensures that the specified users/groups are included in the permission calculation.

#### Inheritance for New Subdirectories
When a new subdirectory is created:
1. It inherits the parent directory's Default ACL as its own **Access ACL**.
2. It also inherits the parent directory's Default ACL as its own **Default ACL**.
This creates a persistent permission chain, ensuring that entire directory trees created by different users maintain consistent access rules.

### Key Tools
- `getfacl`: View the ACL of a file or directory.
- `setfacl`: Modify the ACL of a file or directory.

## Use Case: Shared Folder (Read-Only for some, Read-Write for others)

Imagine a directory `/opt/data` that needs to be accessed by:
- `automation-bot`: Read/Write (uploads data).
- `dev-user-1`: Read-only (monitors data).
- `app-service`: Read-only (processes data).

### Implementation
```bash
# Grant Read/Write to automation-bot
sudo setfacl -m u:automation-bot:rwx /opt/data

# Grant Read-only to dev-user-1 and app-service
sudo setfacl -m u:dev-user-1:rx /opt/data
sudo setfacl -m u:app-service:rx /opt/data
```

## Use Case: Preserving Permissions for Uploaded Files

A common problem when uploading files via `scp` or `rsync` is that the uploaded files might inherit the umask of the uploading user, potentially locking out other users in a shared directory.

### The Solution: Default ACLs
Default ACLs ensure that any new file or subdirectory created within a folder automatically inherits specific permissions, regardless of the creator's umask.

You can set Default ACLs in two ways with `setfacl`:
1. Using the `-d` flag: `setfacl -d -m u:user:rwx /path`
2. Using the `d:` prefix: `setfacl -m d:u:user:rwx /path`

```bash
# Set default permissions for the directory
sudo setfacl -d -m u:automation-bot:rwx /opt/data
sudo setfacl -d -m u:dev-user-1:rx /opt/data
```

Now, if `automation-bot` uploads a file `data_dump.json`, `dev-user-1` will automatically have read access to it.

## Use Case: Collaborative Writing (Shared Read/Write)

In a high-collaboration environment where multiple users (e.g., `dev1`, `dev2`, `dev3`) need to edit the same configuration files or logs in `/var/log/app-shared`:

### Implementation
1. **Set the Access ACL** (for existing files):
   ```bash
   sudo setfacl -R -m u:dev1:rwx,u:dev2:rwx,u:dev3:rwx /var/log/app-shared
   ```
2. **Set the Default ACL** (for future files):
   ```bash
   sudo setfacl -d -m u:dev1:rwx,u:dev2:rwx,u:dev3:rwx /var/log/app-shared
   ```

### Inheriting Group Permissions
Alternatively, you can use a shared group:
```bash
sudo setfacl -d -m g:dev-group:rwx /var/log/app-shared
```

## Best Practices for File Uploads

When using the `key-manager.js` utility or manual tools for uploading:
1. **Always use Default ACLs** on the target directories.
2. **Use `rsync -p`** (or `--perms`) if you want to preserve the specific source permissions, but be aware that Default ACLs on the target will usually override or merge with these.
3. **Verify with `getfacl`**:
   ```bash
   getfacl /path/to/uploaded/file
   ```
   If there is a `+` sign at the end of the standard permission string (e.g., `-rw-rwxr--+`), an ACL is active.

### Client-Side Pitfall: "Operation Not Permitted" Errors

When uploading files via `scp` or `rsync`, some clients are configured to **preserve ownership** (`-o` for rsync, or default settings in GUI clients like WinSCP/FileZilla).

**The Problem**:
A regular user (e.g., `alice`) cannot change the owner of a file to another user (e.g., `app-runner`). If the client tries to do this, the server will return an **"Operation not permitted"** error.

**The Solution**:
- **Disable Ownership Preservation**: Configure your client to *not* try to preserve the owner/group. The file should be owned by the user who uploaded it; the **Default ACLs** on the server will handle the shared access.
- **Rsync Recommendation**: Use `rsync -rlpt` (preserve links, permissions, and times) but avoid `-o` (owner) and `-g` (group).
- **GUI Clients**: Check the transfer settings and ensure "Preserve file permissions/ownership" is disabled if you encounter errors.

## Use Case: Rapid Preview & Testing (App Versioning)

In a fast-paced development environment, developers often need to bypass the CI process to get quick feedback from QA or end-users. This involves syncing a local build to a development server for immediate preview.

### The Scenario
- **Target Path**: `/opt/deploy/versions`
- **Application Service (`app-runner`)**: Needs read access to all versions to start the application.
- **Developers (`dev1`, `dev2`)**: Need full control over their own version subdirectories to upload/sync files.
- **QA/End-Users**: Access the application via its interface (e.g., web) once it is started by the `app-runner`. They do not need filesystem access.

### Implementation Strategy

1. **Prepare the Root Directory**:
   ```bash
   sudo mkdir -p /opt/deploy/versions/users
   ```

2. **Setup Developer Folders**:
   Each developer gets a folder where they are the primary owner, but the `app-runner` has persistent access to serve the content.
   ```bash
   # For developer 'alice'
   sudo mkdir -p /opt/deploy/versions/users/alice
   sudo chown alice:alice /opt/deploy/versions/users/alice
   
   # Grant app-runner read access to existing and FUTURE files
   sudo setfacl -m u:app-runner:rx /opt/deploy/versions/users/alice
   sudo setfacl -d -m u:app-runner:rx /opt/deploy/versions/users/alice
   ```

3. **Rapid Update Workflow**:
   Developers can now use `rsync` to update their preview environment in seconds:
   ```bash
   # On developer machine
   rsync -avz --delete ./dist/ alice@dev-server:/opt/deploy/versions/users/alice/current-feat/
   ```
   Because of the **Default ACLs**, the `app-runner` service can immediately read the new files to start the preview. QA and other team members can then access the updated application through its normal interface for verification.

### Switching the "Active" App Version
To make the application start from a specific developer's version, you can use a symbolic link that the `app-runner` follows:
```bash
# Point the main app path to alice's feature branch
sudo ln -sfn /opt/deploy/versions/users/alice/current-feat /opt/deploy/versions/main
```
The `app-runner` only needs read permissions on the symlink and the target directory, which are already guaranteed by the ACLs set above.

## Use Case: Production Deployment (CI/CD)

In production, deployments are handled by an automated service account. This user ensures that only verified builds from the CI pipeline are released.

### The Scenario
- **Target Path**: `/opt/deploy/versions/ci`
- **Deployment User (`deploy-user`)**: An automation account that uploads official build artifacts.
- **Application Service (`app-runner`)**: Reads the authorized versions to start the production app.

### Implementation Strategy
```bash
# Create the production version directory
sudo mkdir -p /opt/deploy/versions/ci
sudo chown deploy-user:deploy-user /opt/deploy/versions/ci

# Grant app-runner read access to all official builds
sudo setfacl -m u:app-runner:rx /opt/deploy/versions/ci
sudo setfacl -d -m u:app-runner:rx /opt/deploy/versions/ci
```

---

## Combined Environment: CI Builds + Developer Previews

On a **development or staging server**, you can combine both strategies. This allows the `app-runner` to switch between official CI builds and rapid developer syncs for quick testing sessions.

### Directory Structure
```text
/opt/deploy/versions/
├── ci/                 <-- Official builds (managed by deploy-user)
│   ├── v1.0.1/
│   └── v1.0.2/
└── users/              <-- Developer previews (managed by individual devs)
    ├── alice/
    └── bob/
```

### Unified ACL Configuration
To ensure the `app-runner` can access everything on a dev server:
```bash
# Apply recursive ACLs to the entire versions root
sudo setfacl -R -m u:app-runner:rx /opt/deploy/versions
sudo setfacl -R -d -m u:app-runner:rx /opt/deploy/versions
```

### The Workflow
1. **Official Test**: Point the app to a CI build:
   `sudo ln -sfn /opt/deploy/versions/ci/v1.0.2 /opt/deploy/versions/main`
2. **Quick Fix Test**: A developer syncs a fix and the app is pointed to their folder:
   `sudo ln -sfn /opt/deploy/versions/users/alice/fix-issue-42 /opt/deploy/versions/main`

This hybrid approach provides the stability of CI-tested versions with the agility of direct developer synchronization, all managed securely through ACLs.
