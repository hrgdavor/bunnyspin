import {$} from 'bun'
import { changeConfigFile } from "../../src/util.js";
import { cleanCommon, prepareCommon } from "../../src/buildDocker.js";
import { zabixCopyConfPhp } from '../../src/install/zabbix.js';

await prepareCommon()
//steps that are in       T E S T I N G                 bun .\build.js 2


console.log("Zabbix...");
const ZABBIX_VERSION = "8.0";
const ZABBIX_DEB = `zabbix-release_latest_${ZABBIX_VERSION}+ubuntu24.04_all.deb`;
const downloadUrl = `https://repo.zabbix.com/zabbix/${ZABBIX_VERSION}/release/ubuntu/pool/main/z/zabbix-release/${ZABBIX_DEB}`;

await $`wget -q ${downloadUrl}
dpkg -i ./${ZABBIX_DEB}
apt-get update
apt-get -y install --no-install-recommends zabbix-server-mysql zabbix-frontend-php zabbix-sql-scripts zabbix-agent sudo
apt-get -y install --no-install-recommends php8.3-bcmath php8.3-mbstring php8.3-gd php8.3-xml php8.3-mysql php8.3-ldap php8.3-curl locales
locale-gen en_US.UTF-8
rm ./${ZABBIX_DEB}
`;


await cleanCommon()
