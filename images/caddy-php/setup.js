import { $ } from "bun";
import { cleanCommon, prepareCommon } from "../../src/buildDocker.js";
import { CADDY_CONF_D } from "../../src/install/caddy.js";
import { addRepoPhp, getPhpVersion, phpPackages } from "../../src/install/php8.js";

await prepareCommon()

// test installing php in a second step, so it must detect used version
const version = await getPhpVersion()
addRepoPhp()
await $`apt-get -y --no-install-recommends install ${phpPackages(version,'curl','mysql')}`

await $`mkdir -p /var/www && chown caddy:www-data /var/www`

await Bun.write('/var/www/index.php', `<?php echo "hello".(1+1) ?>`)

await Bun.write(CADDY_CONF_D + '/test.local.conf', `
test.local {
  root * /var/www
  encode gzip
  log {
      output file /var/log/caddy/test.local.log
  }
  php_fastcgi unix//run/php/php8.3-fpm.sock
  file_server
}
`)

await cleanCommon()
