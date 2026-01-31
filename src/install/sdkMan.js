import { $ } from 'bun'
import { addWelcomeMessage, readLines, WELCOME_FILE_FISH } from '../util';

const SDKMAN_DIR = "/usr/local/sdkman";

export async function installSdkMan(addWelcome) {
  process.env.SDKMAN_DIR = SDKMAN_DIR;

  console.log("Installing SDKMAN!");
  await $`curl -s "https://get.sdkman.io?rcConfig=false" | bash`;

  // Configure SDKMAN to be non-interactive
  const configPath = `${SDKMAN_DIR}/etc/config`;
  const configContent = `sdkman_auto_answer=true
  sdkman_auto_selfupdate=false
  sdkman_insecure_ssl=false`;
  await Bun.write(configPath, configContent);

  // Permissions
  await $`chmod -R 755 ${SDKMAN_DIR}`;

  if(addWelcome) await installSdkManWelcome()
}

export async function installSdkManWelcome() {
  const lines = await readLines(WELCOME_FILE_FISH)
  await Bun.write(WELCOME_FILE_FISH, addWelcomeMessage(lines,
`  echo "  - skdman - manage multiple java versions and other java tools - https://sdkman.io"
  echo "    - use: \\"sdk list java\\" to see available version"
  echo "    - use: \\"sdk install java 25.0.2-tem\\" to instal a specific version like 25.0.2 Temurin"
`).join('\n'))
}


export async function installSdkManForFish() {
  await $`
  echo Initializing SDKMAN for Fish...
  fish -c "fisher install reitzig/sdkman-for-fish"
  fish -c "sdk help"
  `;
  await Bun.write("/root/.config/fish/conf.d/00_sdkman.fish",
  `set -gx SDKMAN_DIR "${SDKMAN_DIR}"
  `);

}

export async function installSdkManJava(version, addWelcome){
  const listOutput = (await $`bash -c "source ${SDKMAN_DIR}/bin/sdkman-init.sh && sdk list java"`.text());
  const javaVersion = findLatest(25, listOutput);
  console.log(`Latest versions found: Java ${version}: ${javaVersion}`);
  if (javaVersion) {
    console.log(`Installing Java 25 (${javaVersion})...`);
    await runSdk(`sdk install java ${javaVersion}`);
    if(addWelcome) await installSdkManJavaWelcome(javaVersion)
    return javaVersion
  }
}

export async function installSdkManJavaWelcome(javaVersion) {
  const lines = await readLines(WELCOME_FILE_FISH)
  await Bun.write(WELCOME_FILE_FISH, addWelcomeMessage(lines,
`  echo "  - Java - ${javaVersion}"`).join('\n'))
}


/**
 * Helper to run commands in SDKMAN environment
 */
const runSdk = async (cmd) => {
    return await $`bash -c "source ${SDKMAN_DIR}/bin/sdkman-init.sh && ${cmd}"`;
}

const findLatest = (major, listOutput) => {
    const regex = new RegExp(`${major}\\.\\d+\\.\\d+-tem`, 'g');
    const matches = listOutput.match(regex);
    return matches ? matches[0] : null;
}
