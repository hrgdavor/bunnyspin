import { $, spawn } from "bun";
import { existsSync } from 'fs'
import { addWelcomeMessage, isDocker, readLines, WELCOME_FILE_FISH } from "../util.js";
import { addSuperProgram } from "./supervisor.js";
import console from "console";

export const MY_DATADIR = "/var/lib/mysql";
export const MY_SOCKET = "/var/run/mysqld/mysqld.sock";

/** mysql installation on top ubuntu image has challenges, especially because
 * post install script tries to start/stop service, but in docker enviroment
 * systemct deos not work. Also you must consider handling of mysql data,
 * will it be part of image or a volume. For VPS normal install works ofc.
 *
 * this function depends on main script messing with policy-rc.
 *
 */
export async function installMysql(addWelcome) {
  console.log("Pre-seeding MySQL configurations...");
  // Prevent interactive password prompts
  await $`echo "mysql-server mysql-server/root_password password ''" | debconf-set-selections`;
  await $`echo "mysql-server mysql-server/root_password_again password ''" | debconf-set-selections`;

  console.log("Installing MySQL...");
  await $`apt-get update && apt-get install -y --no-install-recommends mysql-server`;

  if (isDocker) {
    await $`echo Docker workarounds for mysql
      mkdir -p /var/run/mysqld
      chmod 755 /var/run/mysqld
      chown mysql:mysql /var/run/mysqld
      usermod -d /var/lib/mysql/ mysql
      `;
    addSuperProgram('mysql',`/usr/bin/mysqld_safe`,{user:'mysql'})
  } else {
    console.log("VPS detected: Enabling MySQL service...");
    await $`systemctl enable mysql`;
  }

  console.log("MySQL install complete!");
  if(addWelcome) await installMysSQLWelcome()
}

export async function installMysSQLWelcome() {
  if (!existsSync(WELCOME_FILE_FISH)) return;
  const lines = await readLines(WELCOME_FILE_FISH)
  await Bun.write(WELCOME_FILE_FISH, addWelcomeMessage(lines, `  echo "  - mysql - mysql database server"
  echo "    - root password was randomly generated"`).join('\n'))
}

export async function ensureInsecureMySQL() {
  // Check if the socket already exists and responds to a ping
   const isAlive = existsSync(MY_SOCKET) &&
     (await $`mysqladmin ping --socket=${MY_SOCKET} --silent`.quiet()).exitCode === 0;

   if (isAlive) {
     console.log("MySQL is already running in insecure mode. Attaching...");
     return;
   }

   console.log("Starting MySQL...");

   // Start mysqld in the background
   // We use .quiet() to prevent it from flooding the build logs
   // const server = $`mysqld --user=mysql --skip-grant-tables --skip-networking --socket=${MY_SOCKET}`;
  const proc = spawn(["mysqld", "--user=mysql",
     `--datadir=${MY_DATADIR}`,
     // "--skip-grant-tables",
     "--skip-networking",
     `--socket=${MY_SOCKET}`
   ], {
     stdout: "inherit", // Useful for debugging; change to "ignore" for clean logs
     stderr: "inherit",
   });

  // Wait for the socket to become active
  let attempts = 0;

   while (attempts < 60) {
     attempts++;
     await Bun.sleep(1000);
     console.log(await $`ps aux`.text())
     console.log(attempts)
     if (!existsSync(MY_SOCKET)) continue;
     const ping = await $`mysqladmin ping --socket=${MY_SOCKET}`//.quiet();
     if (ping.exitCode === 0) {
       console.log("MySQL is ready for provisioning.");
       return;
     }
   }

   throw new Error("MySQL failed to start in a reasonable timeframe.");
}
