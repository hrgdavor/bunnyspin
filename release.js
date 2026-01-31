import { $ } from "bun";

async function release() {
  console.log("🚀 Starting release process...");

  console.log("🔢 Bumping versions...");
  await $`bun x changeset version`;

  console.log("📦 Syncing lockfile...");
  await $`bun install`;

  // Bun publish automatically handles workspace:* replacement
  console.log("🚢 Publishing to NPM...");
  await $`bun x changeset publish`;

  console.log("✅ Release complete!");
}

release().catch(console.error);
