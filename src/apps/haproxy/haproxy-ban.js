import { writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { connect } from "node:net";

const SOCKET_PATH = "/var/run/haproxy.sock";
const BAN_MAP = "/etc/haproxy/banlist.map";
const WHITE_MAP = "/etc/haproxy/whitelist.map";
const RATE_THRESHOLD = 150;
const BAN_TTL_MS = 24 * 60 * 60 * 1000;

// Helper to interact with HAProxy Runtime API
async function haproxyCmd(cmd) {
  return new Promise((resolve) => {
    const client = connect(SOCKET_PATH, () => client.write(`${cmd}\\n`));
    let buffer = "";
    client.on("data", (d) => buffer += d.toString());
    client.on("end", () => resolve(buffer));
    client.on("error", () => resolve(""));
  });
}

/**
 * Permanently whitelist an IP so it can never be banned
 */
export async function whitelistIP(ip) {
  await haproxyCmd(`add map ${WHITE_MAP} ${ip} 1`);
  appendFileSync(WHITE_MAP, `${ip} 1\\n`);
  console.log(`[WHITELISTED] ${ip}`);
}

/**
 * Checks if IP is in the whitelist file
 */
function isWhitelisted(ip) {
  if (!existsSync(WHITE_MAP)) return false;
  return readFileSync(WHITE_MAP, "utf-8").includes(`${ip} `);
}

export async function banIP(ip) {
  if (isWhitelisted(ip)) return; // Safety check
  const now = Date.now();
  await haproxyCmd(`add map ${BAN_MAP} ${ip} ${now}`);
  appendFileSync(BAN_MAP, `${ip} ${now}\\n`);
  console.log(`[BANNED] ${ip}`);
}

export async function unbanIP(ip) {
  await haproxyCmd(`del map ${BAN_MAP} ${ip}`);
  const lines = readFileSync(BAN_MAP, "utf-8").split("\\n");
  const filtered = lines.filter(l => l.trim() && !l.startsWith(`${ip} `));
  writeFileSync(BAN_MAP, filtered.join("\\n") + "\\n");
  console.log(`[UNBANNED] ${ip}`);
}

/**
 * Purges bans older than BAN_TTL_MS
 */
async function cleanupBans() {
  const now = Date.now();
  const content = readFileSync(BAN_MAP, "utf-8").split("\\n");
  const validEntries = [];

  for (const line of content) {
    const [ip, timestamp] = line.split(" ");
    if (ip && timestamp && now - parseInt(timestamp) < BAN_TTL_MS) {
      validEntries.push(line);
    } else if (ip) {
      await haproxyCmd(`del map ${BAN_MAP} ${ip}`);
      console.log(`[EXPIRED] ${ip}`);
    }
  }
  writeFileSync(BAN_MAP, validEntries.join("\\n") + "\\n");
}

/**
 * Real-time monitoring loop
 */
async function monitor() {
  const data = await haproxyCmd("show table main_lb");
  const matches = data.matchAll(/entry\\.key=([0-9.]+) .*http_req_rate\\(10s\\)=(\\d+)/g);

  for (const [_, ip, rate] of matches) {
    if (parseInt(rate) > RATE_THRESHOLD && !isWhitelisted(ip)) {
      await banIP(ip);
      await haproxyCmd(`clear table main_lb key ${ip}`);
    }
  }
}

// Parse command line arguments
const args = Bun.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'monitor':
      console.log('[MONITOR] Running one-time monitor check');
      await monitor();
      break;
    case 'cleanup':
      console.log('[CLEANUP] Running ban cleanup');
      await cleanupBans();
      break;
    case 'whitelist':
      if (!args[1]) {
        console.log('Error: IP address required');
        console.log('Usage: bun script.js whitelist <IP>');
        process.exit(1);
      }
      await whitelistIP(args[1]);
      break;
    case 'is-whitelisted':
      if (!args[1]) {
        console.log('Error: IP address required');
        console.log('Usage: bun script.js is-whitelisted <IP>');
        process.exit(1);
      }
      console.log(`[${isWhitelisted(args[1]) ? 'YES' : 'NO'}] ${args[1]} is whitelisted`);
      break;
    case 'ban':
      if (!args[1]) {
        console.log('Error: IP address required');
        console.log('Usage: bun script.js ban <IP>');
        process.exit(1);
      }
      await banIP(args[1]);
      break;
    case 'unban':
      if (!args[1]) {
        console.log('Error: IP address required');
        console.log('Usage: bun script.js unban <IP>');
        process.exit(1);
      }
      await unbanIP(args[1]);
      break;
    default:
      console.log('Usage: bun script.js <command> [IP]');
      console.log('Commands:');
      console.log('  monitor           - Run one-time monitoring check');
      console.log('  cleanup           - Run one-time ban cleanup');
      console.log('  whitelist <IP>    - Whitelist an IP');
      console.log('  is-whitelisted <IP> - Check if IP is whitelisted');
      console.log('  ban <IP>          - Ban an IP');
      console.log('  unban <IP>        - Unban an IP');
      process.exit(1);
  }
}

main().catch(console.error);
