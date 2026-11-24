// In-memory + persisted activity log.
// Entries: { ts, type, message, data } — newest last.
const log = require('./logService');
const db = require('./db');

let handlers = [];

const MAX_ACTIVITY = 1000;

function addActivity(type, message, data) {
  const entry = { ts: new Date().toISOString(), type, message, data: data || null };
  db.update('activity', (list) => {
    list.push(entry);
    return list.slice(-MAX_ACTIVITY);
  });
  log.info(`[activity] ${type}: ${message}`);
  for (const h of handlers) {
    try { h(entry); } catch { /* a broken subscriber must not break the log */ }
  }
  return entry;
}

function onNewActivity(handler) {
  handlers.push(handler);
  return () => { handlers = handlers.filter((h) => h !== handler); };
}

function listActivity(limit) {
  const all = db.get('activity') || [];
  const n = typeof limit === 'number' && limit > 0 ? limit : 50;
  return all.slice(-n).reverse();
}

module.exports = { addActivity, onNewActivity, listActivity, MAX_ACTIVITY };
