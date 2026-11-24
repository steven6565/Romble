// Real system statistics: uptime, CPU (via /proc/stat), memory (via os).
const fs = require('fs');
const os = require('os');
const { loadEnv } = require('./env');

loadEnv();

const startTime = Date.now();
const cpuCache = { ts: 0, usage: 0, inFlight: null };

function uptime() {
  return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
}

function uptimeFormatted(sec) {
  const s = typeof sec === 'number' ? sec : uptime();
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d}d ${pad(h)}:${pad(m)}:${pad(ss)}`;
}

function readFirstCpuLine() {
  try {
    const line = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0] || '';
    return line.replace(/^cpu\s+/, '').split(/\s+/).map(Number);
  } catch {
    return null;
  }
}

async function sampleCpuUsage() {
  const a = readFirstCpuLine();
  if (!a) return 0;
  await new Promise((r) => setTimeout(r, 350));
  const b = readFirstCpuLine();
  if (!b) return 0;
  const sum = (arr) => arr.reduce((s, v) => s + v, 0);
  const totalDelta = sum(b) - sum(a);
  const idleDelta = (b[3] || 0) + (b[4] || 0) - ((a[3] || 0) + (a[4] || 0));
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((totalDelta - idleDelta) / totalDelta) * 100)));
}

async function cpu() {
  const now = Date.now();
  if (cpuCache.inFlight) return cpuCache.inFlight;
  if (now - cpuCache.ts < 300) return cpuCache.usage;
  cpuCache.inFlight = sampleCpuUsage().then((usage) => {
    cpuCache.usage = usage;
    cpuCache.ts = Date.now();
    cpuCache.inFlight = null;
    return usage;
  });
  return cpuCache.inFlight;
}

function memory() {
  try {
    const total = os.totalmem();
    const free = os.freemem();
    return {
      totalBytes: total,
      freeBytes: free,
      usedBytes: Math.max(0, total - free),
      usedPercent: total > 0 ? Math.round(((total - free) / total) * 1000) / 10 : 0
    };
  } catch {
    return { totalBytes: 0, freeBytes: 0, usedBytes: 0, usedPercent: 0 };
  }
}

function platformInfo() {
  return {
    os: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    pid: process.pid,
    inTermux: Boolean(process.env.PREFIX)
  };
}

module.exports = { uptime, uptimeFormatted, cpu, memory, platformInfo, startTime };
