import { $ } from "bun";
import { installFish } from '../../src/install/fish.js'
import { isDocker, WELCOME_FILE_FISH } from "../../src/util.js";
import { cleanCommon, prepareCommon } from "../../src/buildDocker.js";

await prepareCommon()
process.chdir("/tmp");
await $`echo docker:${isDocker}`


await $`
echo Install few preferred utils
apt-get install -y --no-install-recommends curl unzip ca-certificates vim wget git zip xz-utils software-properties-common gnupg btop sudo
echo desert color scheme for vim
echo "colo desert" > /root/.vimrc
apt-get upgrade -y
`

installSupervisor()

await installFish()
await Bun.write(WELCOME_FILE_FISH,`
function fish_greeting
  echo
  echo
  echo (set_color yellow)"Welcome to base server"(set_color normal)
  echo
  echo "some nice things pre-installed"
  echo "  - bun - JS toolkit - https://bun.sh/ "
  echo "  - fish - shell, 90s FTW - https://fishshell.com "
  echo "  - btop - pretty top TUI - https://github.com/aristocratos/btop"
  echo "\nto change this welcome message, edit /root/.config/fish/functions/fish_greeting.fish"
  echo
  echo
end
`)


await cleanCommon()
console.log("Setup JS complete!");
