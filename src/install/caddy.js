import { $ } from 'bun';
import { addWelcomeMessage, isDocker, prependFile, readLines, WELCOME_FILE_FISH } from '../util';
import { addSuperProgram } from './supervisor';

export const CADDY_FILE = '/etc/caddy/Caddyfile'
export const CADDY_CONF_D = '/etc/caddy/conf.d'

export async function installCaddy(addWelcome){
// Caddy Server
  await $`
echo Installing Caddy...
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y --no-install-recommends caddy
mkdir -p ${CADDY_CONF_D}
`;

  if (isDocker) {
    addSuperProgram('caddy', `caddy run --config ${CADDY_FILE} --adapter caddyfile`, { user: 'caddy' })
  }


  prependFile(CADDY_FILE, `
{
    # Correct global directive to prevent Caddy from modifying system certs
    storage file_system /var/lib/caddy
    skip_install_trust
}

`,
`
# setup to handle adding new configs in a dir for nicer separation
import ${CADDY_CONF_D}/*

`)
  if(addWelcome) await installCaddyWelcome()
}

export async function installCaddyWelcome() {
  const lines = await readLines(WELCOME_FILE_FISH)
  await Bun.write(WELCOME_FILE_FISH, addWelcomeMessage(lines,
`  echo "  - caddy - caddy web server for easier HTTPS https://caddyserver.com/"
  echo "    - main config: ${CADDY_FILE}"
  echo "    - configs dir: ${CADDY_CONF_D}"
`).join('\n'))
}
