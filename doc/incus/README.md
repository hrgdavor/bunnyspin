# Incus Administration

This directory contains documentation and guides for managing and configuring Incus (LXD fork) for server provisioning.

## Key Concepts

### ID Map Shifting
ID mapping shifting is a powerful feature that simplifies sharing host directories with containers. It allows you to mount a host disk or folder into a container while automatically "shifting" the host's UIDs and GIDs to match those inside the container's namespace. This eliminates the need for manual `chown` operations when multiple containers or the host need to share the same storage.

For a deep dive into how to use this for shared CI caches and development environments, see [ID Mapping Details](file:///d:/wrk/bunnyspin/doc/incus/id.mapping.md).
