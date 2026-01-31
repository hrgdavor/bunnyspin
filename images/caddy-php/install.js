import { $ } from "bun";
import { cleanCommon, prepareCommon } from "../../src/buildDocker.js";
import { installPhp8 } from "../../src/install/php8.js";
import { installCaddy } from "../../src/install/caddy.js";

await prepareCommon()

await installCaddy(true)
await installPhp8('8.3')

await cleanCommon()
