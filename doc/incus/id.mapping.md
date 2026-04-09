# ID Mapping and Shifting in Incus

ID mapping is one of the most powerful features of Incus (and LXD), allowing you to run unprivileged containers while sharing host storage without complex permission issues.

## The Problem: UID/GID Mismatch
In an unprivileged container, the "root" user inside might actually be UID 1000000 on the host. If you mount a host directory owned by UID 1000, the container sees it as `nobody:nogroup` (or some other numeric ID).

Normally, you'd have to choose between:
1.  **Privileged containers** (unsafe: root inside is root outside).
2.  **Manual `chown`** (slow and breaks if you share with multiple containers).

## The Solution: Shifting (`shift=true`)
Incus can use a kernel feature (like `shiftfs` or VFS idmap shifting) to dynamically translate IDs at the mount point.

### Example: Shared Maven Cache for CI (Jenkins)

When running a Jenkins CI pool where each runner is an Incus container, you want all runners to share a single host `.m2` repository to save bandwidth and time.

#### 1. Setup the Runner User
Ensure the `jenkins` user in the container has a consistent UID/GID (e.g., 1000).

#### 2. Add the Device with Shifting
Execute this command on the host to attach the shared cache to your runner container:

```bash
incus device add runner-01 m2-cache disk \
    source=/mnt/ci-ssd/jenkins-shared-m2 \
    path=/home/jenkins/.m2 \
    shift=true
```

#### Why this works:
- **Inside the container**: The `jenkins` user (UID 1000) can read/write to `/home/jenkins/.m2` normally.
- **On the host**: The files are owned by the host's UID 1000 (or whichever user originally created them).
- **No Conflict**: Multiple containers (runner-01, runner-02, etc.) can all mount the same host path. Incus shifts the IO operations on the fly so each container sees its own local UID as the owner.

## Configuration Requirements
To use `shift=true`, your system must support it. Modern Linux kernels (5.12+) with VFS idmap support are ideal.

### Manual ID Mapping (The Alternative)
If shifting isn't available, you can manually map specific UIDs in the container's configuration:

```bash
# Map host UID 1000 to container UID 1000
printf "u 1000 1000\ng 1000 1000" | incus config set runner-01 raw.idmap -
```

This tells Incus to "punch a hole" in the 1,000,000 UID range and map host 1000 directly to container 1000. While effective, it's less flexible than `shift=true`.
