# Why Incus for Linux Provisioning?

For **lightweight Linux provisioning**, Incus is an excellent—arguably the best—choice. It occupies the "sweet spot" between heavy virtual machines and application-centric containers like Docker.

## 1. "System" vs. "Application" Containers
Unlike Docker, which is designed for single applications (one process per container), Incus provides **System Containers**. 

*   **Docker**: Difficult to run `systemd`, `cron`, or multiple background services without complex hacks or multiple containers.
*   **Incus**: Behaves exactly like a VPS or bare-metal server. It boots a full `systemd` init system, allowing you to use standard provisioning tools (Ansible, Cloud-init, shell scripts) without modification.

## 2. Extreme Efficiency (Lightweight)
Because Incus uses the host's Linux kernel (LXC), it has **near-zero overhead** compared to virtual machines (KVM/VirtualBox).

*   **RAM Consumption**: A fresh Ubuntu container in Incus typically uses only **~15-30MB** of idle RAM.
*   **Performance**: CPU and I/O performance are native. There is no instruction translation or hardware emulation layer.
*   **Storage Efficiency**: It uses "copy-on-write" (ZFS/BTRFS/LVM), so creating a new provisioned instance from a snapshot takes milliseconds and uses almost no extra space initially.

## 3. Built-in Provisioning Tools
Incus has native support for professional-grade provisioning:

*   **Cloud-Init**: Pass a `user-data` file during creation to automatically handle users, SSH keys, and package installs on the first boot.
*   **Snapshots & Images**: Provision a "base" container, snapshot it, and instantly spin up dozens of identical clones for testing.
*   **Bridged Networking**: Easier to give a container its own IP address on your local network compared to Docker's port-mapping approach.

## 4. Alignment with `bunnyspin`
For a project like `bunnyspin`, which aims to spin up stacks across development, staging, and production:

*   **Environment Fidelity**: An Incus container is much closer to a real VPS (like Hetzner or AWS) than a Docker container. If your provisioning script works in Incus, it will almost certainly work on a production server.
*   **Iterative Workflow**: The ability to `incus delete --force test-box && incus launch ubuntu:22.04 test-box` in seconds enables a fast "test, purge, and retry" loop.

## Summary Comparison
| Feature               | Virtual Machine (KVM)  | Docker                   | **Incus (System Containers)**         |
| --------------------- | ---------------------- | ------------------------ | ------------------------------------- |
| **Isolation**         | High (Separate Kernel) | Low (Shared Kernel)      | **High (Shared Kernel + Namespaces)** |
| **Resource Weight**   | Heavy (GBs of RAM)     | Very Light               | **Very Light**                        |
| **Full Systemd**      | Yes                    | No (requires hacks)      | **Yes (Native)**                      |
| **Provisioning Ease** | Standard               | Specialized (Dockerfile) | **Standard (Scripts)**                |


To simulate real servers with minimal resource usage, **Incus is the superior choice.** It provides the full environment of a VM with the speed and lightness of a container.

## When to still use Docker?

While Incus is better for general system provisioning, Docker remains essential in specific scenarios:

### 1. Application Packaging and Distribution
Docker is primarily a packaging format. If you need to build a single, portable artifact (like a Go or Zig binary) that runs identically on any machine with a container runtime, Docker is the industry standard.

### 2. CI/CD Pipeline Contexts
Most CI platforms (GitHub Actions, GitLab CI) are designed to run in Docker containers. For short-lived, stateless build/test environments, Docker's process-centric model and image layering are highly efficient.

### 3. Provisioning for a "Docker Pool"
Interestingly, **Incus can be used to provision a Docker host.** 
You might use Incus (and `bunnyspin` scripts) to provision a raw VPS or VM that is specifically designed to be an **instance for running Docker containers**. For example, you can create a cluster of Incus containers on your high-performance local hardware, each provisioned with Docker installed, to act as a **local CI pool** for your projects. 

This gives you the best of both worlds:
- **Incus** handles the OS-level provisioning (users, firewall, swap, Docker installation).
- **Docker** handles the actual application execution and build steps.
