import { $ } from "bun";
import { installMysql, installMysSQLWelcome } from "../../src/install/mysql.js";
import { cleanCommon, prepareCommon } from "../../src/buildDocker.js";
import { installPhp8 } from "../../src/install/php8.js";

await prepareCommon()
// steps that are      D O N E  /  O K           bun .\build.js 1        to rebuild/verify

await installMysql(true);
await installPhp8()

//    C L E A N
await cleanCommon()
