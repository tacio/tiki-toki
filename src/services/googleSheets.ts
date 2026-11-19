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
 * 8. Set "Who has access": "Anyone" (allows your app to push logs directly)
 * 9. Click "Deploy", authorize permissions, and copy the Web app URL (ends in /exec).
 * 10. Paste that URL into Tiki-Toki Settings!
 */

const SHEET_NAME = 'Tiki-Toki Log';

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Tiki-Toki bridge is live and ready',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000); // 10s wait lock for concurrency safety

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
      lock.releaseLock();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Tiki-Toki connected successfully!'
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

    lock.releaseLock();

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
  }
}
`;

export async function testGoogleSheetsConnection(url: string): Promise<{ success: boolean; message: string }> {
  if (!url || !url.startsWith('https://script.google.com/macros/s/')) {
    return {
      success: false,
      message: 'Invalid URL. It must be a Google Apps Script Web App URL starting with https://script.google.com/macros/s/'
    };
  }

  try {
    const payload = JSON.stringify({ action: 'ping' });
    const response = await fetch(url, {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();
    if (data.status === 'success' || data.status === 'ok') {
      return { success: true, message: data.message || 'Connected to Google Sheets successfully!' };
    } else {
      return { success: false, message: data.message || 'Unknown response format from Google Apps Script' };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Could not connect to Google Apps Script. Please verify the URL and deployment settings.'
    };
  }
}

export async function syncEntriesToGoogleSheets(
  url: string,
  entries: TotemEntry[]
): Promise<{ success: boolean; syncedIds: string[]; error?: string }> {
  if (!url || entries.length === 0) {
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

    const response = await fetch(url, {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      redirect: 'follow',
    });

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
    return {
      success: false,
      syncedIds: [],
      error: err.message || 'Network error syncing with Google Sheet',
    };
  }
}
