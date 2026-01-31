import { $ } from 'bun'
import { addWelcomeMessage, readLines, WELCOME_FILE_FISH } from '../util'

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
