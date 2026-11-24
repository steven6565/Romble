// Timestamped file + in-memory log service.
// Writes to logs/backend.log with size-based rotation.
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./env');

loadEnv();

const LOG_DIR = process.env.LOG_DIR || 'logs';
const LOG_FILE = path.join(LOG_DIR, 'backend.log');
const RING_LIMIT = 3000; // entries kept in memory for the dashboard
const MAX_FILE_BYTES = 5 * 1024 * 1024; // rotate at ~5MB

let ring = [];
let writeReady = false;

function ts() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function ensureDir() {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); writeReady = true; }
  catch { writeReady = false; }
}

function rotateIfNeeded() {
  if (!writeReady) { ensureDir(); if (!writeReady) return; }
  try {
    const st = fs.statSync(LOG_FILE);
    if (st.size > MAX_FILE_BYTES) {
      fs.renameSync(LOG_FILE, LOG_FILE + '.1');
    }
  } catch { /* file missing or unreadable — fine */ }
}

function append(line) {
  try {
    rotateIfNeeded();
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch { /* logging must never crash the server */ }
  ring.push(line);
  if (ring.length > RING_LIMIT) ring.shift();
  while (ring.length > RING_LIMIT) ring.shift();
}

function log(level, message) {
  const line = `[${ts()}] [${level}] ${message}`;
  append(line);
}

function info(message) { log('INFO', message); }
function warn(message) { log('WARN', message); }
function error(message) { log('ERROR', message); }
function debug(message) { log('DEBUG', message); }

function recent(n) {
  const limit = typeof n === 'number' && n > 0 ? Math.min(n, RING_LIMIT) : RING_LIMIT;
  return ring.slice(-limit).map((l) => l);
}

function clearRing() { ring = []; }

module.exports = { log, info, warn, error, debug, recent, clearRing, ts };
