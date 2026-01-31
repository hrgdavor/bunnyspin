import { $ } from "bun";
import { addWelcomeMessage, isDocker, readLines, WELCOME_FILE_FISH } from "../util.js";

/** mysql installation on top ubuntu image has challenges, especially because
 * post install script tries to start/stop service, but in docker enviroment
 * systemct deos not work. Also you must consider handling of mysql data,
 * will it be part of image or a volume. For VPS normal install works ofc.
 *
 * depends on main script messing with policy-rc.d
 *
 */
export async function installMysql(addWelcome) {

  console.log("Pre-seeding MySQL configurations...");
  // Prevent interactive password prompts
  await $`echo "mysql-server mysql-server/root_password password root" | debconf-set-selections`;
  await $`echo "mysql-server mysql-server/root_password_again password root" | debconf-set-selections`;

  console.log("Installing MySQL...");
  await $`apt-get update && apt-get install -y --no-install-recommends mysql-server`;

  if (isDocker) {
    await $`echo Docker workarounds for mysql
      mkdir -p /var/run/mysqld
      chmod 755 /var/run/mysqld
      chown mysql:mysql /var/run/mysqld
      usermod -d /var/lib/mysql/ mysql
      `;
    await Bun.write('/etc/supervisor/conf.d/mysql.conf', `
[program:mysql]
# Use mysqld_safe or mysqld to keep the process in the foreground
command=/usr/bin/mysqld_safe
user=mysql
autostart=true
autorestart=true
# Redirect logs to container stdout/stderr for visibility in 'docker logs'
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
`)

  } else {
    console.log("VPS detected: Enabling and starting MySQL service...");
    await $`systemctl enable mysql && systemctl start mysql`;
  }

  console.log("MySQL install complete!");
  if(addWelcome) await installMysqlWelcome()
}

export async function installMysqlWelcome() {
  const lines = await readLines(WELCOME_FILE_FISH)
  await Bun.write(WELCOME_FILE_FISH, addWelcomeMessage(lines, `  echo "  - mysql - mysql database server"
  echo "    - IMPORTANT! change default root password"`).join('\n'))
}
