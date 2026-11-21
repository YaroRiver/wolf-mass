/**
 * Wolf Mass — Google Sheet sync endpoint.
 *
 * Install (once):
 *   1. Open the "Wolf Mass Data" sheet → Extensions → Apps Script.
 *   2. Replace everything in Code.gs with this file. Save.
 *   3. Select the function `setup` → Run → allow access. The log prints your KEY.
 *   4. Deploy → New deployment → type: Web app.
 *      Execute as: Me · Who has access: Anyone → Deploy. Copy the Web app URL.
 *   5. In the site: Data → Google Sheet sync → paste URL and KEY → Save.
 *
 * The site POSTs {key, type, data}. Types: checkin, session, engine, health, bulk.
 * GET ?key=...  returns every tab as JSON (used by History and Pull).
 */

const TABS = {
  CheckIns: ['date', 'week', 'weight', 'waist', 'sleep', 'rhr', 'knee', 'energy', 'legsHeavy', 'swelling', 'updated'],
  Sessions: ['date', 'week', 'session', 'notes', 'updated'],
  Sets:     ['date', 'week', 'session', 'exerciseId', 'exercise', 'set', 'kg', 'reps', 'text', 'updated'],
  Engine:   ['date', 'week', 'w1', 'w2', 'w3', 'w4', 'w5', 'avgW', 'spreadPct', 'rpe', 'peakHr', 'updated'],
  Health:   ['date', 'week', 'sleepHours', 'rhr', 'hrv', 'source', 'updated'],
  Workouts: ['date', 'week', 'session', 'minutes', 'avgHr', 'maxHr', 'activeKcal', 'source', 'updated'],
  Weekly:   ['week', 'start', 'end', 'avgWeight', 'rateKg', 'waist', 'avgSleep', 'avgRhr', 'avgHrv', 'kneeMax', 'sessions', 'benchTop', 'pullupTop', 'bikeAvgW', 'calorieCall', 'updated']
};
const START = new Date(2026, 10, 23); // Mon 23 Nov 2026

/** KEY: from Config.gs (SYNC_KEY, kept out of git) or from Script Properties set by setup(). */
function getKey() {
  if (typeof SYNC_KEY !== 'undefined' && SYNC_KEY) return SYNC_KEY;
  return PropertiesService.getScriptProperties().getProperty('KEY');
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, TABS[name].length).setValues([TABS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Аркуш1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  const props = PropertiesService.getScriptProperties();
  let key = (typeof SYNC_KEY !== 'undefined' && SYNC_KEY) ? SYNC_KEY : props.getProperty('KEY');
  if (!key) { key = Utilities.getUuid().replace(/-/g, '').slice(0, 20); props.setProperty('KEY', key); }
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('rollup').timeBased().everyDays(1).atHour(4).create();
  Logger.log('KEY: ' + key);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.key !== getKey()) return out({ ok: false, error: 'bad key' });
    const d = body.data || body; // flat bodies allowed (iOS Shortcuts)
    if (body.type === 'checkin') putCheckin(d);
    else if (body.type === 'session') putSession(d);
    else if (body.type === 'engine') putEngine(d);
    else if (body.type === 'health') putHealth(d);
    else if (body.type === 'workout') putWorkout(d);
    else if (body.type === 'bulk') {
      Object.keys(d.body || {}).forEach(date => putCheckin(Object.assign({ date: date }, d.body[date])));
      Object.keys(d.log || {}).forEach(date => putSession(Object.assign({ date: date }, d.log[date])));
      (d.engine || []).forEach(putEngine);
    } else return out({ ok: false, error: 'unknown type' });
    rollup();
    return out({ ok: true, type: body.type });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  if ((e.parameter || {}).key !== getKey()) return out({ ok: false, error: 'bad key' });
  const ss = SpreadsheetApp.getActiveSpreadsheet(), res = { ok: true };
  Object.keys(TABS).forEach(name => res[name] = rows(ss.getSheetByName(name)));
  return out(res);
}

/* writers */
function putCheckin(d) {
  upsert('CheckIns', d.date, [d.date, weekOf(d.date), d.weight, d.waist, d.sleep, d.rhr, d.knee, d.energy, !!d.legsHeavy, !!d.swelling, now()]);
}
function putSession(d) {
  upsert('Sessions', d.date, [d.date, weekOf(d.date), d.session, d.notes || '', now()]);
  const sh = sheet('Sets'), vals = sh.getDataRange().getValues();
  for (let i = vals.length - 1; i >= 1; i--) if (ds(vals[i][0]) === d.date) sh.deleteRow(i + 1);
  const names = d.names || {}, out = [];
  Object.keys(d.sets || {}).forEach(id => (d.sets[id] || []).forEach((s, i) => {
    if (s && (s.w != null || s.r != null || s.t)) out.push([d.date, weekOf(d.date), d.session, id, names[id] || id, i + 1, v(s.w), v(s.r), v(s.t), now()]);
  }));
  if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
}
function putEngine(d) {
  const w = (d.w || []).filter(Number), avg = w.length ? w.reduce((a, b) => a + b, 0) / w.length : '';
  const spread = w.length ? (Math.max.apply(null, w) - Math.min.apply(null, w)) / avg * 100 : '';
  upsert('Engine', d.date, [d.date, weekOf(d.date), w[0] || '', w[1] || '', w[2] || '', w[3] || '', w[4] || '', round(avg, 0), round(spread, 1), d.rpe || '', d.hr || '', now()]);
}
function putHealth(d) {
  const date = d.date || ds(new Date());
  const sleep = d.sleepRaw ? sleepFromRaw(d.sleepRaw) : num(d.sleepHours);
  upsert('Health', date, [date, weekOf(date), sleep, num(d.rhr), num(d.hrv), d.source || 'shortcut', now()]);
}

/** sleepRaw: one line per Health sample, "<stage>;<duration>". Awake and In Bed are skipped. */
function sleepFromRaw(raw) {
  let sec = 0;
  String(raw).split(/\r?\n/).forEach(line => {
    let stage, dur;
    if (line.indexOf(';') >= 0) { const p = line.split(';'); stage = p[0]; dur = p.slice(1).join(';'); }
    else { const m = String(line).match(/^([^\d]*)(\d.*)$/); if (!m) return; stage = m[1]; dur = m[2]; }
    if (/awake|in ?bed/i.test(stage)) return;
    sec += durSec(dur);
  });
  return sec ? Math.round(sec / 360) / 10 : '';
}
function durSec(t) {
  t = String(t).trim().replace(',', '.');
  let m = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return m[3] !== undefined ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2]);
  let s = 0, hit = false;
  t.replace(/([\d.]+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)\b/gi, (_, n, u) => {
    hit = true; u = u.toLowerCase();
    s += parseFloat(n) * (u[0] === 'h' ? 3600 : u[0] === 'm' ? 60 : 1);
  });
  if (hit) return s;
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

function putWorkout(d) {
  const date = d.date || ds(new Date());
  upsert('Workouts', date, [date, weekOf(date), d.session || '', num(d.minutes), num(d.avgHr), num(d.maxHr), num(d.activeKcal), d.source || 'shortcut', now()]);
}

/* weekly archive */
function rollup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ci = rows(ss.getSheetByName('CheckIns')), he = rows(ss.getSheetByName('Health'));
  const se = rows(ss.getSheetByName('Sessions')), st = rows(ss.getSheetByName('Sets')), en = rows(ss.getSheetByName('Engine'));
  const out = [];
  let prevAvg = null;
  for (let w = 1; w <= 12; w++) {
    const a = new Date(START.getTime() + (w - 1) * 7 * 864e5), b = new Date(a.getTime() + 6 * 864e5);
    const inW = r => Number(r.week) === w;
    const cw = ci.filter(inW), hw = he.filter(inW);
    if (!cw.length && !hw.length && !se.filter(inW).length) { prevAvg = null; continue; }
    const avgW = mean(cw.map(r => r.weight));
    const sleep = mean(hw.map(r => r.sleepHours).concat(cw.filter(r => !hw.some(h => h.date === r.date)).map(r => r.sleep)));
    const rhr = mean(hw.map(r => r.rhr).concat(cw.map(r => r.rhr)));
    const hrv = mean(hw.map(r => r.hrv));
    const waist = last(cw.map(r => r.waist));
    const knee = Math.max.apply(null, [0].concat(cw.map(r => Number(r.knee) || 0)));
    const top = id => { const s = st.filter(r => inW(r) && r.exerciseId === id && r.kg !== ''); if (!s.length) return ''; s.sort((x, y) => (y.kg - x.kg) || (y.reps - x.reps)); return s[0].kg + '×' + s[0].reps; };
    const bike = mean(en.filter(inW).map(r => r.avgW));
    const rate = avgW != null && prevAvg != null ? round(avgW - prevAvg, 2) : '';
    let call = '';
    if (rate !== '') call = w <= 2 ? 'calibration' : rate > 0.4 ? '-150 kcal' : rate < 0.15 ? 'check: +150 if 2 wk low' : rate <= 0.35 ? 'hold' : 'hold, watch';
    out.push([w, ds(a), ds(b), round(avgW, 2), rate, v(waist), round(sleep, 1), round(rhr, 0), round(hrv, 0), knee, se.filter(inW).length, top('bench'), top('pullup'), round(bike, 0), call, now()]);
    prevAvg = avgW;
  }
  const sh = ss.getSheetByName('Weekly');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, TABS.Weekly.length).clearContent();
  if (out.length) sh.getRange(2, 1, out.length, out[0].length).setValues(out);
}

/* helpers */
function sheet(n) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n); }
function upsert(name, date, row) {
  const sh = sheet(name), vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) if (ds(vals[i][0]) === date) { sh.getRange(i + 1, 1, 1, row.length).setValues([row]); return; }
  sh.appendRow(row);
}
function rows(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(), h = v[0];
  return v.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k] = (r[i] instanceof Date) ? ds(r[i]) : r[i]); return o; });
}
function ds(d) { if (!(d instanceof Date)) return String(d); return Utilities.formatDate(d, 'Australia/Melbourne', 'yyyy-MM-dd'); }
function weekOf(date) { const p = String(date).split('-').map(Number); const d = new Date(p[0], p[1] - 1, p[2]); return Math.floor((d - START) / 864e5 / 7) + 1; }
function mean(a) { a = a.filter(x => x !== '' && x != null && !isNaN(x)).map(Number); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; }
function last(a) { a = a.filter(x => x !== '' && x != null); return a.length ? a[a.length - 1] : null; }
function round(x, n) { return x == null || x === '' || isNaN(x) ? '' : Math.round(x * Math.pow(10, n)) / Math.pow(10, n); }
function num(x) { if (x == null || x === '') return ''; const n = parseFloat(String(x).replace(',', '.')); return isNaN(n) ? '' : n; }
function v(x) { return x == null ? '' : x; }
function now() { return Utilities.formatDate(new Date(), 'Australia/Melbourne', 'yyyy-MM-dd HH:mm'); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
