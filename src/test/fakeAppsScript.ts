/**
 * Minimal in-memory emulation of the Google Apps Script services used by
 * src/bridge/appsScript.js, faithful enough to catch the behaviours that
 * matter: formula evaluation, apostrophe text-forcing and date auto-conversion.
 */
import bridgeSource from '../bridge/appsScript.js?raw';

export type Cell = string | number | boolean | Date | { formula: string };

const ISO_LIKE = /^\d{4}-\d{2}-\d{2}T/;

/** What Google Sheets does to a raw value written via appendRow/setValues. */
function writeValue(v: unknown): Cell {
  if (typeof v !== 'string') return v as Cell;
  if (v.startsWith("'")) return v.slice(1); // apostrophe forces plain text and is hidden
  if (v.startsWith('=')) return { formula: v }; // would be evaluated as a formula!
  if (ISO_LIKE.test(v)) return new Date(v); // Sheets auto-converts date-looking strings
  return v;
}

export class FakeSheet {
  rows: Cell[][] = [];
  frozenRows = 0;
  constructor(readonly name: string) {}

  appendRow(values: unknown[]) {
    this.rows.push(values.map(writeValue));
  }
  getLastRow() {
    return this.rows.length;
  }
  getLastColumn() {
    return this.rows.reduce((max, r) => Math.max(max, r.length), 0);
  }
  setFrozenRows(n: number) {
    this.frozenRows = n;
  }
  getRange(row: number, col: number, numRows = 1, numCols = 1) {
    const range = {
      getValues: () =>
        Array.from({ length: numRows }, (_, i) =>
          Array.from({ length: numCols }, (_, j) => this.rows[row - 1 + i]?.[col - 1 + j] ?? '')
        ),
      setValues: (values: unknown[][]) => {
        values.forEach((vals, i) => {
          const r = (this.rows[row - 1 + i] ??= []);
          vals.forEach((v, j) => {
            r[col - 1 + j] = writeValue(v);
          });
        });
        return range;
      },
      setBackground: () => range,
      setFontColor: () => range,
      setFontWeight: () => range,
    };
    return range;
  }
}

export function createBridge(initialToken: string | null = 'secret-token') {
  const sheets = new Map<string, FakeSheet>();
  const props = new Map<string, string>();
  if (initialToken) props.set('TOKEN', initialToken);

  const spreadsheet = {
    getName: () => 'My Time Log',
    getSheetByName: (name: string) => sheets.get(name) ?? null,
    insertSheet: (name: string) => {
      const s = new FakeSheet(name);
      sheets.set(name, s);
      return s;
    },
  };

  const runtime = {
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (content: string) => {
        const out = { content, setMimeType: () => out };
        return out;
      },
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) ?? null,
        setProperty: (k: string, v: string) => void props.set(k, v),
      }),
    },
    Utilities: { getUuid: () => crypto.randomUUID() },
    Logger: { log: () => {} },
    console: { error: () => {}, log: () => {} },
  };

  const names = Object.keys(runtime);
  const factory = new Function(
    ...names,
    `${bridgeSource}\nreturn { doGet, doPost, setupToken, sanitizeCell, SHEET_NAME };`
  ) as (...args: unknown[]) => {
    doGet: () => { content: string };
    doPost: (e: unknown) => { content: string };
    setupToken: () => string;
    sanitizeCell: (v: unknown) => unknown;
    SHEET_NAME: string;
  };
  const api = factory(...names.map(n => runtime[n as keyof typeof runtime]));

  const post = (body: unknown) => JSON.parse(api.doPost({ postData: { contents: JSON.stringify(body) } }).content);
  const get = () => JSON.parse(api.doGet().content);

  return { api, post, get, sheets, props, sheet: () => sheets.get(api.SHEET_NAME) };
}
