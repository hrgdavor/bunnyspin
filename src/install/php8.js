import { readdir } from "node:fs/promises";
import { $ } from "bun";
import { changeConfigFile, isDocker } from "../util.js";
import { addSuperProgram } from "./supervisor.js";

let phpVersion

export async function addRepoPhp() {
  await $`add-apt-repository ppa:ondrej/php && apt-get update`
}

export async function installPhp8(version='8.3') {
  phpVersion = version

  addRepoPhp()
  await $`apt-get install -y --no-install-recommends php${version} ${phpPackages(version,'fpm','common')}`

  if (isDocker) {
    await $`mkdir -p /var/php
    chown www-data:www-data /var/php
    mkdir -p /run/php
    chown www-data:www-data /run/php
    `

    // master process runs as root, it will spawn child processes as www-data
    addSuperProgram('php-fpm', 'php-fpm8.3 -F', { user: 'root' })

  }
}

/**
 *
 * @param {string} version like 8.3, 8.4 ...
 * @param  {...any} packages like cron, common that are actually php8.3-cron php8.3-common
 * @returns
 */
export function phpPackages(version, ...packages) {
  return packages.map(p=>`php${version}-${p}`)
}

export async function getPhpVersion() {
  if (!phpVersion) {
    let dirs = (await readdir("/etc/php")).sort()
    phpVersion = dirs[dirs.length-1]
  }
  return phpVersion
}

/**
 * @example  await changeConfigFilePhp('fpm/php-fpm.conf',{error_log: '/var/php/fpm.log'})
 *
 * @param {string} path relative to /etc/php/${version}
 * @param {object} values to override
 * @param {object} values to comment out
 * @param {string} version - if not provided will be detected
 */
export async function changeConfigFilePhp(path, values, commentValues = [], version) {
  if(!version) version = await getPhpVersion()
  await changeConfigFile(`/etc/php/${version}/${path}`, values, ';', commentValues)
}
