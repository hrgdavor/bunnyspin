# base script

This is the folder for creating the base image that has the utils that I want on any provisioned machine.

- bun - https://bun.sh/ JS toolkit used to provision other stuff on images based on this
- fish - shell, 90s FTW - https://fishshell.com
- btop - pretty top TUI - https://github.com/aristocratos/btop
- vim, curl, unzip

> To build the base image:
```
bun ../../build.js ubuntu base.js hrg-base
```

> To build the server image:
```
bun ../../build.js hrg-base server.js hrg-server
```
