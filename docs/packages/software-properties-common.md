# software-properties-common

Pretty heavy adds python3 and some other dependencies. Use if you intend to use python anyway. It typically pulls about 8 to 15 direct dependencies, though this number can grow significantly depending on how many of those are already on your system. 

This package is a utility on Ubuntu that provides an **abstraction layer** for managing software repositories. Instead of manually editing configuration files, it gives you a standardized way to handle software sources from both the command line and the desktop. 

Core Functions

- **Enables `add-apt-repository`**: This is the package's most famous feature. It allows you to add **Personal Package Archives (PPAs)** with a simple command (e.g., `sudo add-apt-repository ppa:user/repo`).
- **Repository Management**: It automates the process of adding, removing, and editing software sources in your `/etc/apt/sources.list` file and the `/etc/apt/sources.list.d/` directory.
- **Backend for GUIs**: It provides the D-Bus backend used by graphical tools like "Software & Updates" (`software-properties-gtk`) to manage mirrors, driver updates, and distribution components (Main, Universe, etc.).
- **Python Integration**: It provides necessary Python 3 modules that let other system tools interact with APT repository settings programmatically. 

## Why do you need it?

Most users encounter this package when following installation guides for third-party software (like **Docker**, **Ansible**, or **Node.js**). If you try to run `add-apt-repository` and get a "command not found" error, you must install this package first using:
`sudo apt update && sudo apt install software-properties-common`

# alternative

If you do not need python3, bunnyspin uses bun, and alternative script can be used [add-apt-repository.js](../../src/add-apt-repository.js).
It should be a good replacement (not guaranteed to work perfectly). For Incus or Docker container this saves approximately **30–50MB** of disk space by avoiding the Python 3 standard library and software-properties-common dependencies.

Even with this script, your Ubuntu image still needs these two tiny packages to handle the security side:

1. **`gnupg`**: For the PPA key validation.
2. **`ca-certificates`**: For the `fetch` command to work over HTTPS.

You can install them with:
`sudo apt update && sudo apt install -y gnupg ca-certificates`
