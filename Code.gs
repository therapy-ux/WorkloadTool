/**
 * OPTIONAL write endpoint for the Service Coordinator tool.
 *
 * The app reads the spreadsheet read-only. This script is what lets the coordinator's
 * progress persist beyond her own browser, so the manager sees the same picture.
 *
 * SETUP
 *  1. Open the spreadsheet → Extensions → Apps Script.
 *  2. Paste this file in, replacing anything already there.
 *  3. Deploy → New deployment → type "Web app".
 *       Execute as: Me
 *       Who has access: Anyone with the link
 *  4. Copy the /exec URL into VITE_TASK_WRITE_URL in your deployment environment.
 *
 * SECURITY NOTE
 *  The /exec URL is a capability — anyone holding it can append task progress rows.
 *  It is NOT a patient-data endpoint: it stores task ids, statuses and free-text notes
 *  the coordinator writes. Keep it out of the repository and rotate it (redeploy) if
 *  it is ever shared. It cannot read or modify the patient tabs.
 *
 *  Because this script can SEND EMAIL as the sheet owner, two guards apply:
 *
 *  1. RECIPIENT ALLOWLIST (always on, and the one that matters). Mail is only ever
 *     sent to an address that already appears in the spreadsheet's therapist email
 *     column. A caller who finds the /exec URL cannot use it to mail anyone else —
 *     it is not a relay. Failures are reported per recipient, never silently dropped.
 *
 *  2. SHARED TOKEN (optional, weak by nature). Set SHARED_TOKEN below and put the
 *     same value in VITE_FOLLOWUP_TOKEN. It stops a stumbled-upon /exec URL from
 *     working on its own. It is NOT a secret: every VITE_* value is compiled into
 *     the public bundle, so treat it as a speed bump, not access control. Leave it
 *     empty to disable the check. The allowlist above is the real protection.
 */

/** Optional shared token. Empty string = no token check. See SECURITY NOTE. */
var SHARED_TOKEN = '';

var SHEET_NAME = 'TaskLog';
var STATE_SHEET = 'ToolState';
var STATE_HEADERS = ['key', 'json', 'updatedAt'];
var CONTACTS_SHEET = 'ToolContacts';
var CONTACTS_HEADERS = ['key', 'role', 'name', 'email', 'updatedAt', 'updatedBy'];
var FOLLOWUP_SHEET = 'TherapistFollowUpLog';
var FOLLOWUP_HEADERS = ['id','therapist','therapistEmail','sentAt','channel','itemCount',
                        'items','message','respondedAt','responseNote','emailed'];
var HEADERS = ['taskId', 'status', 'outcome', 'notes', 'exceptionReason',
               'followUpDate', 'assignee', 'startedAt', 'completedAt', 'updatedAt'];

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function followUpSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(FOLLOWUP_SHEET);
  if (!sh) {
    sh = ss.insertSheet(FOLLOWUP_SHEET);
    sh.appendRow(FOLLOWUP_HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * A small key/value tab for workflow state the spreadsheet has nowhere else to put —
 * currently the copay workflow: what each patient chose, which cash a therapist
 * confirmed, and what went to the finance agent. One JSON blob per key. The client
 * merges record-by-record on load, so two coordinators working at once do not
 * overwrite each other wholesale.
 */
function stateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(STATE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(STATE_SHEET);
    sh.appendRow(STATE_HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readState_(key) {
  var rows = stateSheet_().getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(key)) {
      try { return JSON.parse(rows[i][1] || 'null'); } catch (err) { return null; }
    }
  }
  return null;
}

function writeState_(key, json) {
  var sh = stateSheet_();
  var rows = sh.getDataRange().getValues();
  var stamp = new Date().toISOString();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(key)) {
      sh.getRange(i + 1, 2, 1, 2).setValues([[json, stamp]]);
      return json_({ ok: true, updated: true });
    }
  }
  sh.appendRow([key, json, stamp]);
  return json_({ ok: true, created: true });
}

/**
 * Who the tool hands work to — billing, the finance agent, and anyone added later.
 *
 * These used to live in each coordinator's browser, which meant every person had to
 * be told the addresses and a change reached nobody else. One readable row per
 * contact, so it can be corrected from the app OR edited straight in the sheet.
 */
function contactsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONTACTS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONTACTS_SHEET);
    sh.appendRow(CONTACTS_HEADERS);
    sh.setFrozenRows(1);
    // Seed the slots the tool knows about, so the sheet explains itself.
    sh.appendRow(['billing', 'Billing — where the low-unit list goes', '', '', '', '']);
    sh.appendRow(['finance', 'Finance agent — raises the patient invoices', '', '', '', '']);
  }
  return sh;
}

function listContacts_() {
  var rows = contactsSheet_().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var key = String(rows[i][0] || '').trim();
    if (!key) continue;
    out.push({
      key: key,
      role: String(rows[i][1] || ''),
      name: String(rows[i][2] || ''),
      email: String(rows[i][3] || '').trim(),
      updatedAt: String(rows[i][4] || ''),
      updatedBy: String(rows[i][5] || '')
    });
  }
  return out;
}

/** Upsert by key, so saving one contact never disturbs another. */
function writeContacts_(contacts) {
  var sh = contactsSheet_();
  var rows = sh.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < rows.length; i++) {
    var k = String(rows[i][0] || '').trim();
    if (k) index[k] = i + 1;                        // 1-based sheet row
  }
  var stamp = new Date().toISOString();
  for (var c = 0; c < contacts.length; c++) {
    var it = contacts[c] || {};
    var key = String(it.key || '').trim();
    if (!key) continue;
    var row = [key, String(it.role || ''), String(it.name || ''),
               String(it.email || '').trim(), stamp, String(it.updatedBy || '')];
    if (index[key]) sh.getRange(index[key], 1, 1, CONTACTS_HEADERS.length).setValues([row]);
    else sh.appendRow(row);
  }
  return json_({ ok: true, saved: contacts.length });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** GET ?action=followups → every follow-up record, for the checklist. */
function listFollowUps_() {
  var rows = followUpSheet_().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var rec = {};
    for (var j = 0; j < FOLLOWUP_HEADERS.length; j++) rec[FOLLOWUP_HEADERS[j]] = rows[i][j];
    if (!rec.id) continue;
    try { rec.items = JSON.parse(rec.items || '[]'); } catch (err) { rec.items = []; }
    rec.respondedAt = rec.respondedAt || null;
    rec.responseNote = rec.responseNote || null;
    out.push(rec);
  }
  return out;
}

/** GET ?action=list → the latest progress record per task id. */
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === 'followups') return json_(listFollowUps_());
    if (e && e.parameter && e.parameter.action === 'state') {
      return json_(readState_(e.parameter.key || ''));
    }
    if (e && e.parameter && e.parameter.action === 'contacts') return json_(listContacts_());
    if (!e || !e.parameter || e.parameter.action !== 'list') return json_({});
    var rows = sheet_().getDataRange().getValues();
    var out = {};
    for (var i = 1; i < rows.length; i++) {
      var rec = {};
      for (var j = 0; j < HEADERS.length; j++) rec[HEADERS[j]] = rows[i][j] || null;
      if (!rec.taskId) continue;
      // Rows are appended, so a later row always wins for the same task.
      var prev = out[rec.taskId];
      if (!prev || String(rec.updatedAt) >= String(prev.updatedAt)) out[rec.taskId] = rec;
    }
    return json_(out);
  } catch (err) {
    return json_({ error: String(err) });
  }
}

/**
 * POST. Two shapes:
 *   { taskId, ... }                              → append one TaskProgress row
 *   { action:'followups', email:bool, records:[] } → log follow-ups and, if asked, email them
 *
 * This is the only place a message is actually transmitted. It runs as the sheet
 * owner, so the emails come from her Google account and no credential ever reaches
 * the browser. Daily quota: 100 recipients on a consumer account, 1,500 on Workspace.
 */
/**
 * Serialise writes. Two coordinators saving at the same moment can otherwise
 * interleave inside appendRow and produce a torn row. 20s is longer than any
 * single append needs and shorter than the client's patience.
 */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(20000)) {
      return json_({ ok: false, error: 'busy — another save is in progress, try again' });
    }
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (err) { /* already released */ }
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (SHARED_TOKEN && (!body || body.token !== SHARED_TOKEN)) {
      return json_({ ok: false, error: 'unauthorised' });
    }

    if (body && body.action === 'followups') {
      return withLock_(function () { return handleFollowUps_(body); });
    }

    if (body && body.action === 'contacts') {
      return withLock_(function () { return writeContacts_(body.contacts || []); });
    }

    if (body && body.action === 'state') {
      if (!body.key) return json_({ ok: false, error: 'key is required' });
      return withLock_(function () {
        return writeState_(String(body.key), String(body.json == null ? '' : body.json));
      });
    }

    if (!body || !body.taskId) return json_({ ok: false, error: 'taskId is required' });
    return withLock_(function () {
      var row = HEADERS.map(function (h) { return body[h] == null ? '' : String(body[h]); });
      sheet_().appendRow(row);
      return json_({ ok: true });
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/**
 * Every therapist email that appears anywhere in the spreadsheet, lowercased.
 * This is the allowlist: mail goes to these addresses or to nobody.
 */
function allowedRecipients_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allowed = {};
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var name = sheets[s].getName();
    // Our own tabs. ToolContacts is skipped too: an address WE store must not
    // become an address anyone holding the /exec URL can then mail.
    if (name === SHEET_NAME || name === FOLLOWUP_SHEET ||
        name === STATE_SHEET || name === CONTACTS_SHEET) continue;
    var values = sheets[s].getDataRange().getValues();
    if (!values.length) continue;
    var header = values[0];
    var cols = [];
    for (var c = 0; c < header.length; c++) {
      var h = String(header[c]).toLowerCase();
      if (h.indexOf('mail') !== -1) cols.push(c);
    }
    for (var r = 1; r < values.length; r++) {
      for (var k = 0; k < cols.length; k++) {
        var v = String(values[r][cols[k]] || '').trim().toLowerCase();
        if (v && v.indexOf('@') > 0) allowed[v] = true;
      }
    }
  }
  return allowed;
}

function handleFollowUps_(body) {
  var records = body.records || [];
  var wantEmail = body.email === true;
  var sh = followUpSheet_();
  var sent = 0;
  var failures = [];
  var allowed = wantEmail ? allowedRecipients_() : {};

  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    var emailed = false;

    var addr = String(r.therapistEmail || '').trim().toLowerCase();

    if (wantEmail && addr && !allowed[addr]) {
      // Not a relay: an address that is not in the spreadsheet is never mailed.
      failures.push(r.therapist + ': ' + addr + ' is not a therapist address in this sheet');
    } else if (wantEmail && addr) {
      try {
        MailApp.sendEmail({
          to: r.therapistEmail,
          subject: 'Outstanding items on your patients — Home Recovery',
          body: r.message,
          name: 'Home Recovery Operations'
        });
        emailed = true;
        sent++;
      } catch (err) {
        failures.push(r.therapist + ': ' + String(err));
      }
    } else if (wantEmail) {
      failures.push(r.therapist + ': no email address on file');
    }

    sh.appendRow([
      r.id || '', r.therapist || '', r.therapistEmail || '', r.sentAt || '',
      r.channel || '', (r.items || []).length, JSON.stringify(r.items || []),
      r.message || '', r.respondedAt || '', r.responseNote || '', emailed ? 'TRUE' : 'FALSE'
    ]);
  }

  return json_({ ok: failures.length === 0, sent: sent, failures: failures });
}
