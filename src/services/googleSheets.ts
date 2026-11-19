import { TotemEntry } from '../types';

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * Tiki-Toki 時 — Google Sheets Integration Bridge
 * 
 * Instructions:
 * 1. Open your Google Spreadsheet (or create a new one).
 * 2. In the menu, go to: Extensions > Apps Script
 * 3. Replace all code in the editor with this script.
 * 4. Click "Deploy" > "New deployment"
 * 5. Select type: "Web app"
 * 6. Set Description: "Tiki-Toki Bridge"
 * 7. Set "Execute as": "Me"
 * 8. Set "Who has access": "Anyone" (CRITICAL: prevents redirect to login)
 * 9. Click "Deploy", authorize permissions, and copy the Web app URL (ends in /exec).
 * 10. Paste that URL into Tiki-Toki Settings!
 */

const SHEET_NAME = 'Tiki-Toki Log';

function readSheetEntries(sheet) {
  const entries = [];
  if (!sheet) return entries;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return entries;

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const syncId = String(row[0] || '').trim();
    if (!syncId) continue;

    const loggedAt = row[10] ? String(row[10]) : new Date().toISOString();
    const duration = Number(row[4]) || 0;

    entries.push({
      id: syncId,
      title: String(row[6] || 'Untitled'),
      classification: String(row[5] || 'productive').toLowerCase(),
      tags: row[7] ? String(row[7]).split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [],
      startTime: loggedAt,
      endTime: loggedAt,
      durationMinutes: duration,
      mode: String(row[8] || 'live'),
      notes: String(row[9] || ''),
      syncStatus: 'synced',
      lastSyncedAt: loggedAt
    });
  }
  return entries;
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    const entries = readSheetEntries(sheet);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Tiki-Toki bridge is live and connected!',
      sheetTitle: ss.getName(),
      entries: entries,
      entriesCount: entries.length,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Tiki-Toki bridge is live and ready',
      entries: [],
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10s wait lock for concurrency safety

    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No payload received in request'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Initialize sheet and headers if not present
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      const headers = [
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
        'Logged At'
      ];
      sheet.appendRow(headers);
      
      // Style headers
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#161d28');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    if (data.action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Tiki-Toki connected successfully!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'pull_entries') {
      const entries = readSheetEntries(sheet);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        entries: entries,
        entriesCount: entries.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const entries = data.entries || [];
    const syncedIds = [];

    // Get existing IDs in column 1 to avoid duplicates
    const lastRow = sheet.getLastRow();
    const existingIds = {};
    if (lastRow > 1) {
      const idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < idValues.length; i++) {
        if (idValues[i][0]) {
          existingIds[idValues[i][0]] = i + 2; // Row number
        }
      }
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const startDate = new Date(entry.startTime);
      const endDate = new Date(entry.endTime);

      const rowData = [
        entry.id,
        startDate.toLocaleDateString(),
        startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        Math.round(entry.durationMinutes * 10) / 10,
        entry.classification,
        entry.title,
        (entry.tags || []).join(', '),
        entry.mode,
        entry.notes || '',
        new Date().toISOString()
      ];

      if (existingIds[entry.id]) {
        // Update existing row
        sheet.getRange(existingIds[entry.id], 1, 1, rowData.length).setValues([rowData]);
      } else {
        // Append new row
        sheet.appendRow(rowData);
      }

      syncedIds.push(entry.id);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      syncedCount: syncedIds.length,
      syncedIds: syncedIds
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      // Lock already released or expired
    }
  }
}
`;

export async function testGoogleSheetsConnection(url: string): Promise<{ success: boolean; message: string }> {
  const cleanUrl = (url || '').trim();

  if (!cleanUrl || !cleanUrl.startsWith('https://script.google.com/macros/s/')) {
    return {
      success: false,
      message: 'Invalid URL. It must be a Google Apps Script Web App URL starting with https://script.google.com/macros/s/',
    };
  }

  if (cleanUrl.endsWith('/dev')) {
    return {
      success: false,
      message: 'This is a test URL ending in /dev. You must use the published Web App URL ending in /exec.',
    };
  }

  // 1. Try GET request with an 8-second timeout (tests doGet cleanly without CORS/redirect issues)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(cleanUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'ok' || data.status === 'success') {
        const extra = data.sheetTitle ? ` ("${data.sheetTitle}")` : '';
        return {
          success: true,
          message: `Connected to Google Sheets successfully${extra}!`,
        };
      }
    }
  } catch (getError: any) {
    // If GET failed with timeout
    if (getError.name === 'AbortError') {
      return {
        success: false,
        message:
          'Connection timed out (8s). The most common cause is setting "Who has access" to "Only myself" instead of "Anyone", causing Google to redirect to a login screen. In Apps Script, click Deploy > Manage deployments > Edit > set "Who has access: Anyone".',
      };
    }

    // 2. Fallback: try POST ping with an 8-second timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const postResponse = await fetch(cleanUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'ping' }),
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (postResponse.ok) {
        const postData = await postResponse.json();
        return {
          success: true,
          message: postData.message || 'Connected to Google Sheets successfully!',
        };
      }
    } catch (postError: any) {
      // Both failed
    }

    return {
      success: false,
      message: `Could not connect to Google Apps Script (${getError.message || 'Network error'}). Please verify the URL ends in /exec and "Who has access" is set to "Anyone".`,
    };
  }

  return {
    success: false,
    message: 'Could not verify connection. Please ensure your deployment is published as a Web App.',
  };
}

export async function pullEntriesFromGoogleSheets(
  url: string
): Promise<{ success: boolean; entries: TotemEntry[]; message?: string }> {
  const cleanUrl = (url || '').trim();
  if (!cleanUrl) {
    return { success: false, entries: [], message: 'No Google Sheets URL configured.' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(cleanUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.status === 'ok' && Array.isArray(data.entries)) {
      return {
        success: true,
        entries: data.entries,
        message: `Retrieved ${data.entries.length} totems from Google Sheet.`,
      };
    }

    return {
      success: true,
      entries: [],
      message: 'Connected, but no entries found in the sheet.',
    };
  } catch (err: any) {
    return {
      success: false,
      entries: [],
      message: err.message || 'Failed to pull entries from Google Sheet',
    };
  }
}

export async function syncEntriesToGoogleSheets(
  url: string,
  entries: TotemEntry[]
): Promise<{ success: boolean; syncedIds: string[]; error?: string }> {
  const cleanUrl = (url || '').trim();
  if (!cleanUrl || entries.length === 0) {
    return { success: true, syncedIds: [] };
  }

  try {
    const payload = JSON.stringify({
      action: 'sync_entries',
      entries: entries.map(e => ({
        id: e.id,
        title: e.title,
        classification: e.classification,
        tags: e.tags,
        startTime: e.startTime,
        endTime: e.endTime,
        durationMinutes: e.durationMinutes,
        mode: e.mode,
        notes: e.notes || '',
      })),
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(cleanUrl, {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to reach Google Sheets`);
    }

    const data = await response.json();
    if (data.status === 'success' && Array.isArray(data.syncedIds)) {
      return { success: true, syncedIds: data.syncedIds };
    } else {
      return {
        success: false,
        syncedIds: [],
        error: data.message || 'Failed to sync with Google Sheet',
      };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        syncedIds: [],
        error: 'Sync timed out (15s). Please check your connection or Apps Script deployment.',
      };
    }
    return {
      success: false,
      syncedIds: [],
      error: err.message || 'Network error syncing with Google Sheet',
    };
  }
}
