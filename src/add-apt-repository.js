import { $ } from "bun";
import { parseArgs } from "util";

// CLI Arguments
const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    verbose: { type: "boolean", short: "v" },
  },
  strict: false,
  allowPositionals: true,
});

const verbose = values.verbose;
const ppaInput = positionals[2]; // Equivalent to add-apt-repository <ppa>

if (!ppaInput) {
  console.error("Usage: bun run script.ts <ppa:user/repo> [-v]");
  process.exit(1);
}
// Helper for quiet/verbose logging
const log = (msg: string) => { if (verbose) console.log(msg); };


const osRelease = readFileSync("/etc/os-release", "utf8");
const codenameMatch = osRelease.match(/^VERSION_CODENAME=(.*)$/m);
const codename = codenameMatch ? codenameMatch[1].replace(/"/g, "") : "stable";
log(`Detected Ubuntu version: ${codename}`);

// Ubuntu's mirrors.txt automatically returns mirrors based on your IP address location.
const mirrorsText = await fetch("http://mirrors.ubuntu.com/mirrors.txt").then(r => r.text());
const mirrorList = mirrorsText.trim().split("\n");

let bestMirror = "http://archive.ubuntu.com";
let fastestTime = Infinity;

// Test the first 5 mirrors for speed (ls-lR.gz is a standard small index file)
for (const mirror of mirrorList.slice(0, 5)) {
  const start = performance.now();
  try {
    const response = await fetch(`${mirror}ls-lR.gz`, { method: 'HEAD' });
    if (response.ok) {
      const duration = performance.now() - start;
      log(`- ${mirror}: ${duration.toFixed(2)}ms`);
      if (duration < fastestTime) {
        fastestTime = duration;
        bestMirror = mirror;
      }
    }
  } catch (e) { /* skip failed mirrors */ }
}

log(`Selected: ${bestMirror}`);

// Update System Sources
// For Ubuntu 24.04+ (Deb822 format)
const sourcePath = "/etc/apt/sources.list.d/ubuntu.sources";
if (await $`test -f ${sourcePath}`.exitCode === 0) {
    await $`sed -i "s|URIs: .*|URIs: ${bestMirror}|g" ${sourcePath}`;
} else {
    // For Legacy Ubuntu versions
    await $`sed -i "s|http://archive.ubuntu.com|${bestMirror}|g" /etc/apt/sources.list`;
}

// Add PPA
const ppa = ppaInput.replace(/^ppa:/, "");
const safeName = ppa.replace(/\//g, "-");
const keyringPath = `/etc/apt/keyrings/${safeName}.gpg`;

log(`Adding PPA: ${ppa}`);
await $`mkdir -p /etc/apt/keyrings`;

// Construct the source line
const ppaLine = `deb [signed-by=${keyringPath}] https://ppa.launchpadcontent.net{ppa}/ubuntu ${codename} main`;
await $`echo ${ppaLine} | tee /etc/apt/sources.list.d/${ppa.replace("/", "-")}.list`;

await $`apt-get update`;
