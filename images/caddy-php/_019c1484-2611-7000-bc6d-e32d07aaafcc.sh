
set -e
if [ -f "/usr/local/bin/bun" ]; then
    echo "Bun installed"
else
    if [ ! -f /root/.bun-cache/bun ]; then         echo "Installing Bun..."
        apt-get update
        apt-get install -y --no-install-recommends ca-certificates curl unzip
        curl -fsSL https://bun.sh/install | bash &&         cp /root/.bun/bin/bun /root/.bun-cache/bun;     else         echo "Copy Bun from cache"
        mkdir -p /root/.bun/bin && cp /root/.bun-cache/bun /root/.bun/bin/bun;     fi
    cp /root/.bun/bin/bun /usr/local/bin/bun
fi
    