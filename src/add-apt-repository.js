import { $ } from "bun";

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
      console.log(`- ${mirror}: ${duration.toFixed(2)}ms`);
      if (duration < fastestTime) {
        fastestTime = duration;
        bestMirror = mirror;
      }
    }
  } catch (e) { /* skip failed mirrors */ }
}

console.log(`Selected: ${bestMirror}`);

// Update System Sources
// For Ubuntu 24.04+ (Deb822 format)
const sourcePath = "/etc/apt/sources.list.d/ubuntu.sources";
if (await $`test -f ${sourcePath}`.exitCode === 0) {
    await $`sudo sed -i "s|URIs: .*|URIs: ${bestMirror}|g" ${sourcePath}`;
} else {
    // For Legacy Ubuntu versions
    await $`sudo sed -i "s|http://archive.ubuntu.com|${bestMirror}|g" /etc/apt/sources.list`;
}

// Add PPA
const ppa = "mozillateam/ppa";
const keyringPath = `/etc/apt/keyrings/${ppa.replace("/", "-")}.gpg`;

console.log(`Adding PPA: ${ppa}`);
await $`echo "deb [signed-by=${keyringPath}] https://ppa.launchpadcontent.net{ppa}/ubuntu $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/${ppa.replace("/", "-")}.list`;

await $`sudo apt update`;
