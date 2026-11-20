/**
 * Tiki-Toki 時 — Google Sheets Integration Bridge (v2, token-protected)
 *
 * Setup:
 * 1. Open your Google Spreadsheet (or create one at https://sheets.new).
 * 2. In the menu, go to: Extensions > Apps Script
 * 3. Replace all code in the editor with this script and click Save.
 * 4. In the function dropdown at the top, select "setupToken" and click Run.
 *    Authorize when asked, then copy the token printed in the Execution log.
 *    (Run it again any time to rotate the token.)
 * 5. Click "Deploy" > "New deployment", type "Web app":
 *      - Execute as: "Me"
 *      - Who has access: "Anyone"  (required so the app can reach it;
 *        every request is still checked against your secret token)
 * 6. Copy the Web app URL (ends in /exec).
 * 7. Paste the URL AND the token into Tiki-Toki Settings.
 *
 * Updating an existing deployment: Deploy > Manage deployments > Edit (pencil)
 * > Version: "New version" > Deploy. The /exec URL stays the same.
 */

var SHEET_NAME = 'Tiki-Toki Log';
var BRIDGE_VERSION = 2;
var MAX_ENTRIES_PER_REQUEST = 500;

var HEADERS = [
  'Sync ID',
  'Date',
  'Start Time',
  'End Time',
  'Duration (min)',
  'Classification',
  'Activity / Time Sink',
  'Tags',
  'Mode',
  'Notes',
  'Logged At',
  'Start (ISO)',
  'End (ISO)',
  'Updated At',
  'Deleted'
];

var COL = {
  ID: 0, DATE: 1, START_TIME: 2, END_TIME: 3, DURATION: 4, CLASSIFICATION: 5,
  TITLE: 6, TAGS: 7, MODE: 8, NOTES: 9, LOGGED_AT: 10,
  START_ISO: 11, END_ISO: 12, UPDATED_AT: 13, DELETED: 14
};

var CLASSIFICATIONS = { productive: true, upkeep: true, sink: true };
var MODES = { live: true, retroactive: true };

/** Run once from the Apps Script editor to create (or rotate) the shared secret. */
function setupToken() {
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('TOKEN', token);
  Logger.log('Your Tiki-Toki bridge token (paste it into Tiki-Toki Settings): ' + token);
  return token;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Neutralise spreadsheet formula injection: any user-controlled string that
 * Sheets would interpret as a formula (or that starts with an apostrophe,
 * which Sheets would silently swallow) is forced to plain text.
 */
function sanitizeCell(value) {
  if (typeof value !== 'string') return value;
  if (/^[=+\-@\t\r']/.test(value)) return "'" + value;
  return value;
}

/** Force a value to be stored as text (stops Sheets auto-converting ISO dates). */
function asText(value) {
  return "'" + String(value);
}

function toIso(value, fallback) {
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();
  if (value !== null && value !== undefined && value !== '') {
    var d = new Date(String(value));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return fallback;
}

function isAuthorized(data) {
  var expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!expected) return false;
  return !!data && typeof data.token === 'string' && data.token === expected;
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground('#161d28');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < HEADERS.length) {
    // Upgrade v1 sheets (11 columns) with the new ISO/tombstone columns.
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function readSheetEntries(sheet) {
  var entries = [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return entries;

  var width = Math.max(sheet.getLastColumn(), HEADERS.length);
  var data = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var syncId = String(row[COL.ID] || '').trim();
    if (!syncId) continue;

    var loggedAt = toIso(row[COL.LOGGED_AT], new Date(0).toISOString());
    var startIso = toIso(row[COL.START_ISO], loggedAt);
    var endIso = toIso(row[COL.END_ISO], startIso);
    var updatedAt = toIso(row[COL.UPDATED_AT], loggedAt);
    var classification = String(row[COL.CLASSIFICATION] || 'productive').toLowerCase();
    var mode = String(row[COL.MODE] || 'live');
    var deleted = row[COL.DELETED] === true || String(row[COL.DELETED]).toUpperCase() === 'TRUE';

    entries.push({
      id: syncId,
      title: String(row[COL.TITLE] || 'Untitled'),
      classification: CLASSIFICATIONS[classification] ? classification : 'productive',
      tags: row[COL.TAGS]
        ? String(row[COL.TAGS]).split(',').map(function (s) { return s.trim(); }).filter(Boolean)
        : [],
      startTime: startIso,
      endTime: endIso,
      durationMinutes: Number(row[COL.DURATION]) || 0,
      mode: MODES[mode] ? mode : 'live',
      notes: String(row[COL.NOTES] || ''),
      syncStatus: 'synced',
      lastSyncedAt: loggedAt,
      updatedAt: updatedAt,
      deleted: deleted
    });
  }
  return entries;
}

function isValidIncomingEntry(entry) {
  return (
    !!entry &&
    typeof entry.id === 'string' && /^[\w-]{1,80}$/.test(entry.id) &&
    typeof entry.title === 'string' &&
    CLASSIFICATIONS[entry.classification] === true &&
    typeof entry.durationMinutes === 'number' && isFinite(entry.durationMinutes) &&
    !isNaN(new Date(entry.startTime).getTime()) &&
    !isNaN(new Date(entry.endTime).getTime())
  );
}

function toRow(entry, nowIso) {
  var startDate = new Date(entry.startTime);
  var endDate = new Date(entry.endTime);
  var tags = Array.isArray(entry.tags) ? entry.tags : [];
  return [
    sanitizeCell(entry.id),
    startDate.toLocaleDateString(),
    startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    Math.round(entry.durationMinutes * 10) / 10,
    sanitizeCell(entry.classification),
    sanitizeCell(String(entry.title).slice(0, 500)),
    sanitizeCell(tags.map(String).join(', ').slice(0, 500)),
    sanitizeCell(MODES[entry.mode] ? entry.mode : 'live'),
    sanitizeCell(String(entry.notes || '').slice(0, 5000)),
    asText(nowIso),
    asText(startDate.toISOString()),
    asText(endDate.toISOString()),
    asText(toIso(entry.updatedAt, nowIso)),
    entry.deleted === true
  ];
}

function syncEntries(sheet, entries) {
  var nowIso = new Date().toISOString();
  var lastRow = sheet.getLastRow();
  var existingRows = {};
  if (lastRow > 1) {
    var idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < idValues.length; i++) {
      if (idValues[i][0]) existingRows[String(idValues[i][0])] = i + 2;
    }
  }

  var syncedIds = [];
  var rejectedIds = [];
  for (var j = 0; j < entries.length; j++) {
    var entry = entries[j];
    if (!isValidIncomingEntry(entry)) {
      if (entry && typeof entry.id === 'string') rejectedIds.push(entry.id.slice(0, 80));
      continue;
    }
    var rowData = toRow(entry, nowIso);
    var rowNumber = existingRows[entry.id];
    if (rowNumber) {
      sheet.getRange(rowNumber, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
      existingRows[entry.id] = sheet.getLastRow();
    }
    syncedIds.push(entry.id);
  }
  return { syncedIds: syncedIds, rejectedIds: rejectedIds };
}

/** Public health check only: never returns sheet data. */
function doGet() {
  return jsonOut({ status: 'ok', message: 'Tiki-Toki bridge is live', version: BRIDGE_VERSION });
}

function doPost(e) {
  var data;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ status: 'error', message: 'No payload received' });
    }
    data = JSON.parse(e.postData.contents);
  } catch {
    return jsonOut({ status: 'error', message: 'Invalid JSON payload' });
  }

  if (!isAuthorized(data)) {
    var configured = !!PropertiesService.getScriptProperties().getProperty('TOKEN');
    return jsonOut({
      status: 'error',
      code: configured ? 'unauthorized' : 'token_not_configured',
      message: configured
        ? 'Unauthorized: bridge token missing or incorrect'
        : 'Bridge token not configured: run setupToken() in the Apps Script editor'
    });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getOrCreateSheet();

    if (data.action === 'ping') {
      return jsonOut({
        status: 'success',
        message: 'Tiki-Toki connected successfully!',
        sheetTitle: SpreadsheetApp.getActiveSpreadsheet().getName(),
        version: BRIDGE_VERSION
      });
    }

    if (data.action === 'pull_entries') {
      var pulled = readSheetEntries(sheet);
      return jsonOut({ status: 'success', entries: pulled, entriesCount: pulled.length });
    }

    if (data.action === 'sync_entries') {
      var incoming = Array.isArray(data.entries) ? data.entries : [];
      if (incoming.length > MAX_ENTRIES_PER_REQUEST) {
        return jsonOut({ status: 'error', message: 'Too many entries in one request' });
      }
      var result = syncEntries(sheet, incoming);
      return jsonOut({
        status: 'success',
        syncedCount: result.syncedIds.length,
        syncedIds: result.syncedIds,
        rejectedIds: result.rejectedIds
      });
    }

    return jsonOut({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    console.error(err);
    return jsonOut({ status: 'error', message: 'Internal error in Tiki-Toki bridge' });
  } finally {
    try {
      lock.releaseLock();
    } catch {
      // Lock already released or never acquired
    }
  }
}
