import { $, build } from "bun";
import { chmodSync, existsSync, unlinkSync, writeFileSync } from "node:fs";
import { isDocker } from "./util";

export async function buildDocker(BASE_IMAGE, PROVISION_SCRIPT, NEXT_IMAGE) {
  process.env.DOCKER_BUILDKIT = '1'

  console.log(`Building Docker from ${BASE_IMAGE} calling ${PROVISION_SCRIPT} into ${NEXT_IMAGE}`);
  const BUN_CLI = "/usr/local/bin/bun"
  const TMP_SCRIPT1 = '_' + Bun.randomUUIDv7() + '.sh'
  const TMP_SCRIPT2 = '_' + Bun.randomUUIDv7() + '.js'
  await Bun.write(TMP_SCRIPT1, `
set -e
if [ -f "${BUN_CLI}" ]; then
    echo "Bun installed"
else
    if [ ! -f /root/.bun-cache/bun ]; then \
        echo "Installing Bun..."
        apt-get update
        apt-get install -y --no-install-recommends ca-certificates curl unzip
        curl -fsSL https://bun.sh/install | bash && \
        cp /root/.bun/bin/bun /root/.bun-cache/bun; \
    else \
        echo "Copy Bun from cache"
        mkdir -p /root/.bun/bin && cp /root/.bun-cache/bun /root/.bun/bin/bun; \
    fi
    cp /root/.bun/bin/bun ${BUN_CLI}
fi
    `)
  await Bun.write(TMP_SCRIPT2, (await build({ entrypoints: [PROVISION_SCRIPT], target: "bun", sourcemap: "inline" })).outputs[0])

  // ENV DEBIAN_FRONTEND=noninteractive is crucial to avoid yes/no prompts from dpkg
  // caching apt speed subsequent runs, to celar call: docker buildx prune --filter type=exec.cachemount
  const dockerfile = `
FROM ${BASE_IMAGE}
ARG DEBIAN_FRONTEND=noninteractive
RUN rm -f /etc/apt/apt.conf.d/docker-clean
RUN touch /.dockerenv
COPY ${TMP_SCRIPT1} /tmp/provision.sh
COPY ${TMP_SCRIPT2} /tmp/provision.js
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked\
    --mount=type=cache,target=/var/lib/apt,sharing=locked\
    --mount=type=cache,id=bun-install-cache,target=/root/.bun-cache \
    /tmp/provision.sh && rm /tmp/provision.sh
RUN --mount=type=cache,id=my-apt-cache,target=/var/cache/apt,sharing=locked\
    --mount=type=cache,id=my-apt-cache,target=/var/lib/apt,sharing=locked\
    bun /tmp/provision.js && rm /tmp/provision.js
ENTRYPOINT ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
`;

  try {
    // Use heredoc to create a temporary build context
    await $`echo ${dockerfile} | docker build -t ${NEXT_IMAGE} -f - .`;
  } catch (e) {
    unlinkSync(TMP_SCRIPT1)
    unlinkSync(TMP_SCRIPT2)
    console.log("Failed docker buid ", e.message)
    process.exit(1)
  } finally {
    unlinkSync(TMP_SCRIPT1)
    unlinkSync(TMP_SCRIPT2)
  }

  console.log(`

✨ Docker image from ${BASE_IMAGE} calling ${PROVISION_SCRIPT} into  ${NEXT_IMAGE}  CREATED.

# to start and test the image:
docker run --rm -it ${NEXT_IMAGE}

# to run the image with fish shell as main process instead of image's default:
docker run --rm -it --entrypoint /usr/bin/fish ${NEXT_IMAGE}

# to run image as intended, but also connecto to shell
# first see the CONTAINER_ID, use:
docker ps
# to open fish shell call:
docker exec -it CONTAINER_ID /usr/bin/fish

  `);

}

export async function prepareCommon() {
  process.chdir("/tmp");

  if (isDocker) {
    console.log("Docker detected: Muffling systemctl via policy-rc.d...");
    // Create the policy file to block services from starting during build
    await Bun.write("/usr/sbin/policy-rc.d", "#!/bin/sh\nexit 101");
    chmodSync("/usr/sbin/policy-rc.d", 0o755);
  }
}

export async function cleanCommon() {
  if (isDocker) {
    await $`
echo Cleaning up Docker workarounds...
rm -f /usr/sbin/policy-rc.d
`;
  }

  // Cleanup apt
/*  no more need for this when using cache for apt, it is faster also
await $`
echo Cleaning up...
apt-get autoremove -y
apt-get clean -y
rm -rf /var/lib/apt/lists/*
  `;
*/
}
