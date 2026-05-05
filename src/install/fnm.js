import { $ } from 'bun'
import { addWelcomeMessage, readLines, WELCOME_FILE_FISH } from '../util'

/**
 * Install fnm (Fast Node Manager) via its official installer script.
 *
 * Downloads and runs the upstream install script from fnm.vercel.app,
 * configuring fnm to live under /usr/local/bin and skipping shell
 * configuration (which is handled separately by installFnmWelcome).
 *
 * @returns {Promise<void>} Resolves when the installer exits successfully.
 */
export async function installFnm() {
  $`echo Installing fnm Fast Node Manager
  curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir /usr/local/bin --skip-shell`
}

export async function installFnmWelcome() {
  const lines = await readLines(WELCOME_FILE_FISH)
  await Bun.write(WELCOME_FILE_FISH, addWelcomeMessage(lines,
`  echo "  - FNM - Fast Node Manager (fnm) - https://github.com/Schniz/fnm"
`).join('\n'))
}
