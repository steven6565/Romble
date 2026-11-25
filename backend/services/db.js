// Tiny file-backed JSON database in ./database.
// Files: database/db.json (single document). Writes are atomic (tmp + rename).
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./env');

loadEnv();

const DB_DIR = process.env.DB_DIR || 'database';
const DB_FILE = path.join(DB_DIR, 'db.json');

const DEFAULTS = {
  settings: {},
  activity: [],
  statsHistory: [],
  playback: null,
  analytics: {}
};

const ARRAY_KEYS = ['activity', 'statsHistory'];

function load() {
  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[db] corrupt or unreadable db.json — using defaults:', err.message);
    data = null;
  }
  const merged = Object.assign({}, DEFAULTS, data || {});
  for (const key of ARRAY_KEYS) if (!Array.isArray(merged[key])) merged[key] = [];
  if (merged.analytics === null || typeof merged.analytics !== 'object') merged.analytics = {};
  return merged;
}

function save(data) {
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error('[db] failed to save database:', err.message);
  }
}

function get(key) { return load()[key]; }
function set(key, value) { const d = load(); d[key] = value; save(d); return d[key]; }
function update(key, mutator) {
  const d = load();
  d[key] = mutator(d[key] || []);
  save(d);
  return d[key];
}

module.exports = { load, save, get, set, update, DB_FILE };
