import { $ } from "bun";

const PROVISION_SCRIPT = "test.js";

const vps = "root@your-vps-ip";
// Stream the local Bun script to the remote Bun runtime over SSH
await $`ssh ${vps} "bun -" < ./${PROVISION_SCRIPT}`;
console.log("✨ VPS provisioning complete.");
