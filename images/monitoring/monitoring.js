import { $ } from "bun";

console.log("Starting Monitoring setup (Bun JS)...");

// 2. Install Checkmk Raw
console.log("Installing Checkmk Raw...");
const CHECKMK_VERSION = "2.4.0p19";
const CHECKMK_DEB = `check-mk-raw-${CHECKMK_VERSION}_0.noble_amd64.deb`;
const downloadUrl = `https://download.checkmk.com/checkmk/${CHECKMK_VERSION}/${CHECKMK_DEB}`;

await $`wget -q ${downloadUrl}`;
await $`apt-get install -y --no-install-recommends ./${CHECKMK_DEB}`;
await $`rm ${CHECKMK_DEB}`;

// Create monitoring site
try {
    await $`omd create monitoring`;
} catch (e) {
    console.log("Site 'monitoring' might already exist.");
}
await $`omd start monitoring`;

// 3. Install SigNoz
console.log("Installing SigNoz via Git (more reliable)...");
const SIGNOZ_DIR = "/opt/signoz";
await $`rm -rf ${SIGNOZ_DIR}`;
await $`git clone -b main https://github.com/SigNoz/signoz.git ${SIGNOZ_DIR}`;
process.chdir(`${SIGNOZ_DIR}/deploy`);

// Run the installation script
// We use printf to ensure a single newline and clear delivery
// To mitigate misalignment, we can also set TERM=dumb to simplify output rendering if desired
console.log("Running installer (this may take a few minutes)...");
await $`printf "hrgdavor@gmail.com\n" | ./install.sh --confirm-install`;
console.log("\n"); // Ensure we break the line after the installer finishes


console.log("Monitoring setup complete!");
