import {$} from 'bun'

/**
 * Install fish shell. 90s FTW. https://fishshell.com
 */
export async function installFish() {
  await $`
echo Installing Fish...
add-apt-repository -y ppa:fish-shell/release-4
apt-get update
apt-get install -y --no-install-recommends fish
mkdir -p /root/.config/fish/.conf.d
mkdir -p /root/.config/fish/functions
echo using fish as default shell for root
chsh -s /usr/bin/fish
  `;
  await Bun.write("/root/.config/fish/config.fish", `
if status is-interactive
    # Commands to run in interactive sessions can go here
end

set SERVER (uname -a)
function fish_prompt
    set_color white
    printf " %s @ %s " $USER $SERVER
    set_color yellow
    printf "%s " (pwd)
    set_color green
    printf "%s\n" (fish_git_prompt)
    set_color normal
    printf "> "
end

function fish_title
    printf "%s %s" $SERVER (pwd)
end

alias ll='ls -alhi --color=auto'
alias gp='git pull'
alias lg='lazygit'

`);

  await $`
echo Installing Fisher...
curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | fish -c "source; fisher install jorgebucaran/fisher"
`;

}
