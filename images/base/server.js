import { $ } from "bun";
import { installCaddy } from '../../src/install/caddy.js'
import { isDocker, WELCOME_FILE_FISH } from "../../src/util.js";
import { cleanCommon, prepareCommon } from "../../src/buildDocker.js";
import { installUfw } from "../../src/install/ufw.js";
import { installLazyGit } from "../../src/install/lazyGit.js";
import { installSdkMan, installSdkManJava, installSdkManForFish } from "../../src/install/sdkMan.js";
import { installFnm } from "../../src/install/fnm.js";

await prepareCommon()
process.chdir("/tmp");


await $`echo docker:${isDocker}`

await installCaddy(true)
await installUfw(true)
await installLazyGit(true)
await installFnm(true)
await installSdkMan(true)
await installSdkManForFish()
await installSdkManJava('25', true)



await cleanCommon()
console.log("Setup JS complete!");
