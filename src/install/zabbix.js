import {$} from 'bun'
import { readLines } from "../util"
import { ensureInsecureMySQL } from './mysql'


export async function zabbixInitData() {

  const ZABBIX_MY_PWD = Bun.randomUUIDv7()
  const SQL = `
    create database zabbix character set utf8mb4 collate utf8mb4_bin;
    create user zabbix@127.0.0.1 identified by '${ZABBIX_MY_PWD}';
    create user zabbix@localhost identified by '${ZABBIX_MY_PWD}';
    grant all privileges on zabbix.* to zabbix@localhost;
    grant all privileges on zabbix.* to zabbix@127.0.0.1;
    set global log_bin_trust_function_creators = 1;
  `
  await ensureInsecureMySQL()
  await $`sudo mysql < ${new Response(SQL)}`;
  await $`zcat /usr/share/zabbix/sql-scripts/mysql/server.sql.gz | mysql --default-character-set=utf8mb4 -uzabbix -p${ZABBIX_MY_PWD} zabbix`
  await $`sudo mysql < ${new Response('set global log_bin_trust_function_creators = 0;')}`;

  // AllowUnsupportedDBVersions is needed as slight mismatch triggers this, and we will make suer to use latest DB
  await changeConfigFile('/etc/zabbix/zabbix_server.conf', { DBPassword: ZABBIX_MY_PWD, AllowUnsupportedDBVersions:'1' }, '#')
  zabixCopyConfPhp(ZABBIX_MY_PWD)

  // tweak php values ofr meme and execution
  await changeConfigFile('/etc/php/8.3/fpm/php.ini', {
    post_max_size: '16M',
    max_execution_time: '300',
    max_input_time: '300',
  }, ';')
}

export async function zabixCopyConfPhp(mysqlPwd) {
  const CONF = '/etc/zabbix/web/zabbix.conf.php'
  const lines = await readLines('/usr/share/zabbix/ui/conf/zabbix.conf.php.example')
  let idx = lines.findIndex(line => line.includes(`$DB['PASSWORD']`))
  lines[idx] = `$DB['PASSWORD']                     = '${mysqlPwd}';`
  await Bun.write(CONF, lines.join('\n'))
  await $`chown www-data:www-data ${CONF}`
}
