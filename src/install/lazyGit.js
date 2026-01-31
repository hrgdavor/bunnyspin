import { $ } from 'bun'
import { addWelcomeMessage, readLines, WELCOME_FILE_FISH } from '../util';

export async function installLazyGit(addWelcome) {
  console.log("Installing Lazygit...");
  const rawVersion = await $`curl -s "https://api.github.com/repos/jesseduffield/lazygit/releases/latest"`.text();
  const lazygitVersion = rawVersion.match(/"tag_name": "v([^"]+)"/)[1];
  const downloadUrl = `https://github.com/jesseduffield/lazygit/releases/latest/download/lazygit_${lazygitVersion}_Linux_x86_64.tar.gz`;

  await $`
curl -Lo lazygit.tar.gz ${downloadUrl}
tar xf lazygit.tar.gz lazygit
install lazygit /usr/local/bin
rm lazygit.tar.gz lazygit
  `;

  if(addWelcome) await installLazyGitWelcome()
}

export async function installLazyGitWelcome() {
  const lines = await readLines(WELCOME_FILE_FISH)
  await Bun.write(WELCOME_FILE_FISH, addWelcomeMessage(lines,`  echo "  - lazygit - great git TUI - https://github.com/jesseduffield/lazygit"`).join('\n'))
}
