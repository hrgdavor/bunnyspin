# caveats for multi system provisioning

All of this is specific to building from ubuntu base image and may not work the same on other distros.

## 1. general things for scripted install

To allow packages to be installed without prompts enviroment variable is crucial `ENV DEBIAN_FRONTEND=noninteractive`

Look for instances of `if(isDocker)` to see different workarounds specific to docker enviroment

## good to know www-data

Debian and Ubuntu: The `www-data` group is pre-configured and provided by the base-passwd package, meaning it exists on the system before you even install a web server.

## 2. docker tweaks

- touch - make sure there is a reliable marker when running inside docker 
- supervisord - to allow running multiple services in docker, similar to how it works on VPS or bare-metal

```
source "docker" "ubuntu" {
  image  = "ubuntu:24.04"
  commit = true
  changes = [
    "ENV DEBIAN_FRONTEND=noninteractive",
    "CMD [\"touch\", \"/.dockerenv\"]",
    "CMD [\"/usr/bin/supervisord\", \"-n\", \"-c\", \"/etc/supervisor/supervisord.conf\"]"
  ]
}
```

in 

## 2. caveat (systemd/systemctl)

## 3. caveat mysql 

Zabbix and some others may suffer permission problems when using mylsq local socket (in php if host is localhost instead of 127.0.0.1).
for that reason you need to call `sudo chown mysql:mysql /var/run/mysqld` and `chmod 755 /var/run/mysqld`.
