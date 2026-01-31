
export async function installSupervisor() {
  if (isDocker) {
    await $`apt-get install -y --no-install-recommends supervisor`
  }
}

export async function addSuperProgram(name, command, {user='root', autoRestart=true } = {}) {

  await Bun.write(`/etc/supervisor/conf.d/${name}.conf`, `
[program:${name}]
command=${command}
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
autorestart=${autoRestart ? 'true':'false'}
user=${user}
    `)
}
