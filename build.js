import { $ } from "bun";
import { buildDocker } from "./src/buildDocker.js";

const {argv} = process

if (argv.length <= 4) {
  console.log('Script requires 3 parameters: BASE_IMAGE PROVISION_SCRIPT NEXT_IMAGE []')
  process.exit(1)
}

buildDocker(argv[2], argv[3], argv[4])
