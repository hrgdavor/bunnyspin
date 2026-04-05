# storage box

IMPORTANT: Heztner sotrage box has hard limit on 10 concurrent connections. Make sure to spread out backups to different time slots.


mounting for backp or other use there is community recommended tutorial https://community.hetzner.com/tutorials/setup-autofs-mount-storagebox

Storage Boxes **do not allow interactive shells (TTY)**, preventing standard SSH logins. We solved this by:

1.  **Listing Files:** Using non-interactive commands like `ssh user@host ls` or `echo "ls" | sftp user@host`.
2.  **Bridging the Gap:** Mounting the Storage Box locally using **SSHFS** or **CIFS**. This allows you to use local terminal tools (ls, find, grep) as if the files were on your own drive.
3.  **Persistence:** Adding entries to `/etc/fstab` so the storage mounts automatically after a reboot.

---

Benefits of using Autofs

While editing `/etc/fstab` (specifically with `x-systemd.automount`) is the modern standard, **Autofs** is a dedicated daemon for managing mounts that offers distinct advantages, especially for remote cloud storage like Hetzner.

**1\. Prevents Boot Hangs**  
Standard `fstab` mounts attempt to connect during the boot sequence. If your internet is down or the Hetzner server is unreachable, your local server may **hang for minutes** waiting for a timeout before it finishes booting.

-   **Autofs Benefit:** It ignores the mount at boot. It only attempts to connect **the moment you actually click or `cd` into the folder**.

**2\. Saves Concurrent Connection Slots (Crucial for Hetzner)**  
Hetzner Storage Boxes have a hard limit on concurrent connections (typically 10). If you mount the box permanently on 5 different servers, you are permanently using 5 slots.

-   **Autofs Benefit:** It can be configured to **unmount after a period of inactivity** (e.g., 60 seconds). This frees up the connection slot for other tasks when you aren't actively using the files.

**3\. Auto-Healing for Network Drops**  
If a standard SSHFS connection drops (e.g., WiFi glitch or router restart), the mount point often becomes a "zombie." Accessing it will freeze your terminal (spinning cursor) indefinitely.

-   **Autofs Benefit:** Because it mounts "on demand," if the connection drops, Autofs will detect the fresh access attempt and transparently try to re-establish the connection immediately, effectively "healing" the break without a manual `umount/mount` cycle.

**4\. Cleaner File System**

-   **Autofs Benefit:** Your `/mnt` or `~/storage` directory remains empty until you need it. This prevents accidental writes to the local directory if the mount fails (a common issue where backups fill up the local root disk because the remote drive wasn't mounted).

**Recommendation:**  
If you used the `x-systemd.automount` flag in my previous `fstab` guide, you already have most of these benefits (lazy loading). However, **Autofs** is generally considered more robust for handling unstable network connections and aggressive unmounting to save connection slots.
