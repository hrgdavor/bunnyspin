# bunnyspin

Here is a fun (at least for me) take on spinning up servers, whether it is provisioning or whatnot.

I’ve gone all-in on [Bun](https://bun.sh) for this utility; its blazing-fast, batteries-included approach makes it the perfect engine for me when provisioning VPS servers or Docker images, and it should be an equally good fit for other Docker-compatible environments and even bare-metal servers.

It is wise to keep options open so you can spin up the same stack across different environments: development, CI/CD, staging, and production, without changing my flow. To squeeze as much as possible out of on-prem hardware, and mix it with VPSs or cloud providers wherever it makes practical and economic sense.

**NOTE:** This is an Ubuntu-only zone for now. Whether it's a base image or bare metal, I’ve tuned everything for Ubuntu and don't have immediate plans to branch out to other flavours.

**NOTE** Building multi-component images has downsides, leading to various caveats. And there are differences to account for when provisioning inside docker versus provisioning on a VPS. Speed of iteration and quick layering will offset the extra effort, and deepens the knowledge of docker itself.

I am keeping an eye on https://github.com/pulumi/pulumi/issues/13904 pulumi and bun integration there.

The project will not be publishing packages unless happens some need to do so, for now will use experience collected here and copy parts to real projects.

## Scripting the steps

While many steps are just simple shell commands, the real magic of Bun kicks in when things need som customisation. Instead of jumping through bizarre shell-scripting hoops or trying to become a terminal ninja, Bun’s batteries-included toolkit lets me write clean, maintainable logic without the headache.

Bun isn't just a runtime; it’s a consolidated toolkit that replaces half a dozen separate dev-dependencies.

- **Bun Shell (`$`)**: This is the "hoop-jumper" killer. It provides a cross-platform, bash-like environment that lets you run shell commands directly in TypeScript with proper escaping and piping. No more manual child-process spawning or dealing with inconsistent shell behavior across environments.
- **Lightning-Fast Test Runner**: Built-in and Jest-compatible, this runner is optimized for speed and low memory footprint. It’s perfect for running "smoke tests" against a newly provisioned server to ensure your configs, ports, and permissions are exactly where they should be.
- **Native SQLite & File I/O**: Bun includes a high-performance SQLite driver and ultra-fast `Bun.write` and `Bun.file` APIs. This makes it trivial to log provisioning results, track state, or quickly read/write system configuration files without importing heavy external libraries.
- **Zero-Config TypeScript**: (I personally have no plans to do so, at most will use .js and jsdoc). You can if you prefer even  run `.ts` files directly as scripts—no `tsc` or `ts-node` required. This means your provisioning logic can be type-safe from day one, which is a massive upgrade over brittle `.sh` scripts when things get complex.
- **Growing list of built-ins** - S3, markdown, tar

## Python ?

I am not a fan, so, no way.



# Getting started

## testing

If you want to enter shell of the image you just started without changing its default process (you need it running as intended).
You can use `docker ps` to list active images and then `docker exec -it IMG_ID fish` to execute fish shell.

`fish.js` - utility script is made so you can run fish shell in last image on the list

- `bun fish.js` - bun stays alive until you exit the shell (not optimal, but not too bad)
- `Invoke-Expression (bun fish.js printcmd)` - otpimised for windows 
- `exec $(bun fish.js printcmd)` - otpimised for linux 


# Caveats

## apt vs apt-get and warnings

In 2026, the standard practice for Linux provisioning scripts is to use **`apt-get`** and **`apt-cache`** instead of the `apt` command. 

The "not a stable CLI" warning is a built-in safety feature of `apt` because its output format is designed for human readability (including progress bars and colors) and can change between versions. 

If you use `apt` commands, change to use with their stable equivalents in your scripts: 

| Interactive Command | Scripting Equivalent   | Purpose                             |
| :------------------ | :--------------------- | :---------------------------------- |
| `apt update`        | `apt-get update`       | Refreshes repository index          |
| `apt install`       | `apt-get install -y`   | Installs packages without prompting |
| `apt upgrade`       | `apt-get upgrade -y`   | Upgrades packages                   |
| `apt clean`         | `apt-get clean -y`     | Cleans packages                   |
| `apt autoremove`    | `apt-get autoremove -y`| Auto removes packages               |
| `apt show`          | `apt-cache show`       | Shows package details               |
| `apt search`        | `apt-cache search`     | Searches for packages               |
| `apt full-upgrade`  | `apt-get dist-upgrade` | Handles complex dependency changes  |

## apt lock errors

If you forget to call await on functions that work with apt, you may get the race condition like this.

```
#11 2.751 E: Could not get lock /var/lib/dpkg/lock-frontend. It is held by process 317 (apt-get)
#11 2.751 E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), is another process using it?
```

# Optimisations

## APT and bun install cache

Caching apt, will speed up subsequent runs. you may not see massinve improvement if you 
have a good internet connection, as it also takes some time to unpack and install the packages.
Good layering gives most gains.

> You MUST use `RUN rm -f /etc/apt/apt.conf.d/docker-clean` before any apt runs.

> You MUST prefix every RUN command to use the same cache mount `RUN rm -f /etc/apt/apt.conf.d/docker-clean`

```sh
RUN rm -f /etc/apt/apt.conf.d/docker-clean
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked\
    --mount=type=cache,target=/var/lib/apt,sharing=locked\
    yourscript.sh
```

make sure you see this `Hit:XX http://archive.ubuntu.com/` instead of `Get:XX http://archive.ubuntu.com/` for most of them. Some downloads will still happen as it also donloads metadata to check if there is something new.

To clear the cache for  call: `docker buildx prune --filter type=exec.cachemount`

> Also add a cache for bun, or other programs with custom install you plan to cache

```sh
RUN rm -f /etc/apt/apt.conf.d/docker-clean
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked\
    --mount=type=cache,target=/var/lib/apt,sharing=locked\
    --mount=type=cache,id=bun-install-cache,target=/root/.bun-cache \
    bun_install.sh
```

To only clear bun install cache (to get latest bun):  `docker buildx prune --filter id=bun-install-cache` - because taht is id used in our buildDocker setup script.

# VPS images

[Packer](https://www.packer.io/downloads) is one good option to create binaries for different providers like AWS or Hetzner.

Once you have working bunnyspin layers, you can execute them on a fresh VPS manually, shutdown, create a snapshot, or use packer to automate the process. It may be even better to initially do it manually, to get a feeling of the process, before making api key and letting automation do it.



## Hetzner 

- packer needs actual VPS instance while building images  
- Hetzner charges per minute for the temporary VPS used during the build. Total cost per run of packer script is typically < €0.01. (2026)
- **Snapshot Storage**: Cost is approximately €0.01 per GB per month. (2026)
- Snapshots are stored in your Hetzner Cloud Console under the **Snapshots** tab. They are available project-wide and can be used to launch servers in any location.

#
