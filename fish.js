import { $ } from "bun";
const isPrintCmd = Bun.argv[2] == 'printcmd'
if(!isPrintCmd) console.log("Active Docker Containers:");
if(!isPrintCmd) await $`docker ps`;

// Capture all running container IDs (-q for ids only)
const output = await $`docker ps -q`.text();
const containerIds = output.trim().split("\n").filter(Boolean);

if (containerIds.length === 0) {
  if(!isPrintCmd) console.log("No active containers found.");
  process.exit(0);
}

const lastId = containerIds[containerIds.length - 1];
if(!isPrintCmd) console.log(`\nExecuting fish shell on: ${lastId}`);

if (isPrintCmd) {
  process.stdout.write(`docker exec -it ${lastId} fish`);
} else {
  // Execute using the built-in Bun.spawn for robust terminal inheritance
  Bun.spawn(["docker", "exec", "-it", lastId, "fish"], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
}
