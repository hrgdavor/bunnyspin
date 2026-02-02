import { $ } from "bun";
import { cleanCommon, prepareCommon } from "../../src/buildDocker.js";
import { CADDY_CONF_D } from "../../src/install/caddy.js";
import { zabbixInitData, zabixCopyConfPhp } from "../../src/install/zabbix.js";
import { addSuperProgram } from "../../src/install/supervisor.js";
import { isDocker } from "../../src/util.js";

await prepareCommon()
process.chdir("/tmp");
// steps that are      T O D O

await zabbixInitData()

if (isDocker) {
  await $`chown zabbix:zabbix /etc/zabbix/zabbix_server.conf`
  addSuperProgram('zabbix-server', '/usr/sbin/zabbix_server -f', { user: 'zabbix' })
}

await Bun.write(CADDY_CONF_D + '/zabbix.conf', `
zabbix.local {
  root * /usr/share/zabbix
  encode gzip
  log {
      output file /var/log/caddy/zabbix_access.log
  }
  php_fastcgi unix//run/php/php8.3-fpm.sock
  file_server
}
`)


await cleanCommon()
