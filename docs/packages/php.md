# php

php on ubuntu is on `ppa:ondrej/php` so you need to add the repos and `apt-get update`

```sh
add-apt-repository ppa:ondrej/php && apt-get update`
```

To install php and also connect it to webserver execution requires knowing the version (like ˙8.3`) and likely at leat two packages: `fpm`,`common`.

manually you would for pgp 8.3 call
```sh
apt-get install -y --no-install-recommends php8.3 php8.3-fpm php8.3-common
```

## master process

`php-fpm` has a master process that is intended to run as `root`. It will spawn the processes that execute php code as `www-data`. I learned this the hard way. I had some wrong assumtions so did nto run it as root, and ended-up adding weird fixes for permissions and also did strange config changes (lot of trouble for nothing).

## installing additional packages

In this example we will add `curl` and `mysql` to php `8.3`

> Manually you must be sure of exact version.

```
add-apt-repository ppa:ondrej/php
apt-get update
apt-get -y --no-install-recommends install php8.3-curl php8.3-mysql
```

> this project is all about doing things like this through code
```js
import { addRepoPhp, getPhpVersion, phpPackages } from "../../src/installPhp8.js";

const version = await getPhpVersion()
addRepoPhp()
await $`apt-get -y --no-install-recommends install ${phpPackages(version,'curl','mysql')}`
```


# Caveats

- If you are using apache2, you are advised to add ppa:ondrej/apache2
- If you are using nginx, you are advised to add ppa:ondrej/nginx
