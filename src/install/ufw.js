import { $ } from 'bun'
import { addWelcomeMessage, isDocker, readLines, WELCOME_FILE_FISH } from '../util';

/**
 * Insall uff
 */
export async function installUfw(addWelcome) {
  // UFW firewall
  await $`
  echo Configuring UFW
  apt-get install -y --no-install-recommends ufw
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow ssh
  ufw allow http
  ufw allow https
  `;

  if (!isDocker) {
    await $`echo "y" | ufw enable`;
  }
  if(addWelcome) await installUfwWelcome()
}

export async function installUfwWelcome() {
  const lines = await readLines(WELCOME_FILE_FISH)
  await Bun.write(WELCOME_FILE_FISH, addWelcomeMessage(lines,
`  echo "  - UFW - firewall - https://help.ubuntu.com/community/UFW"
  echo "    - only http,https,ssh are open. Use: \\"ufw allow port\\"  to add more"`).join('\n'))
}
