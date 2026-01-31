import {$} from 'bun'
import { readLines } from "../util"


export async function zabixCopyConfPhp(mysqlPwd) {
  const CONF = '/etc/zabbix/web/zabbix.conf.php'
  const lines = await readLines('/usr/share/zabbix/ui/conf/zabbix.conf.php.example')
  let idx = lines.findIndex(line => line.includes(`$DB['PASSWORD']`))
  lines[idx] = `$DB['PASSWORD']                     = '${mysqlPwd}';`
  await Bun.write(CONF, lines.join('\n'))
  await $`chown www-data:www-data ${CONF}`
}
