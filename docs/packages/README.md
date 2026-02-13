# packages used in provisioning scripts of bunnyspin

## general
- [software-properties-common](./software-properties-common.md) - you will likely want to use PPA, and is used here for many setups
-

## cross platform help

Initially bunnyspin started with docker as base for iterating and testing provisioning, but has proven to be problematic
for use-case where provisioning script is supposed to work on VPS or VM as well as Docker. [incus](https://linuxcontainers.org/incus/) was 
chosen as better alternative even though is problematic to use on windows (since goal is to be able to work on VPS, having a Linux machine
for developing provision scripts is not a big ask)

- [supervisor](./supervisor.md) - alternative to use in docker images because systemd is not available

## WEB

- [HAProxy](./HAProxy.md) load balancer (that is also useful for HTTPS migration) 
- Caddy 
- [PHP](./php.md)

## databases

- [MySQL](./mysql.md)
-
