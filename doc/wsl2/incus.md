# Running Incus on WSL2 (Ubuntu)

Incus can be used inside WSL2, but it requires `systemd` to be enabled. Windows 11 is recommended for better support of nested virtualization if VMs are needed (containers work with less friction).

## 1. Enable Systemd in WSL2
Incus requires `systemd` to manage its daemon and containers.

1.  In your Ubuntu terminal, edit `/etc/wsl.conf`:
    ```bash
    sudo nano /etc/wsl.conf
    ```
2.  Add the following lines:
    ```ini
    [boot]
    systemd=true
    ```
3.  **Restart WSL2**: Open PowerShell on Windows and run `wsl --shutdown`. Then restart your Ubuntu distribution.

## 2. (Optional) Enhance WSL2 Performance
For the best experience (especially if you plan to run virtual machines instead of just containers), create or edit `%USERPROFILE%\.wslconfig` in Windows:

```ini
[wsl2]
nestedVirtualization=true
# Support for Cgroup v2 is better for Incus
kernelCommandLine=cgroup_no_v1=all
```

## 3. Install Incus
The most reliable way to install Incus on Ubuntu is via the **Zabbly** repository:

```bash
# Add the Zabbly repository key
sudo mkdir -p /etc/apt/keyrings/
sudo curl -fsSL https://pkgs.zabbly.com/key.asc -o /etc/apt/keyrings/zabbly.asc

# Add the repository
sudo sh -c 'cat <<EOF > /etc/apt/sources.list.d/zabbly-incus-stable.sources
Enabled: yes
Types: deb
URIs: https://pkgs.zabbly.com/incus/stable
Suites: $(. /etc/os-release && echo ${VERSION_CODENAME})
Components: main
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/zabbly.asc
EOF'

# Install Incus
sudo apt update
sudo apt install incus
```

## 4. Initialize Incus
After installation, add your user to the administrative group and initialize the daemon:

```bash
sudo usermod -aG incus-admin $USER
# Apply group membership without logging out
newgrp incus-admin

# Run the initialization wizard
incus admin init
```

## ⚠️ Important Considerations
*   **Networking**: WSL2 uses a NAT network by default. If you need your Incus containers to be accessible from your physical LAN, consider using the `mirrored` networking mode in your `.wslconfig`.
*   **Kernel Support**: While most container features work out-of-the-box, some advanced storage drivers (like ZFS) or specialized modules (like `vhost_vsock` for VMs) might require a custom WSL2 kernel if the default Microsoft one doesn't include them.
