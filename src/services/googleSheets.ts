import type { TotemEntry } from '../types';
import { filterValidEntries } from '../types/guards';
import bridgeSource from '../bridge/appsScript.js?raw';

/** The Apps Script the user pastes into their spreadsheet. Same file the bridge tests execute. */
export const GOOGLE_APPS_SCRIPT_TEMPLATE: string = bridgeSource;

const WEB_APP_PATH = /^\/(?:a\/macros\/[\w.-]+|macros)\/s\/[\w-]+\/exec$/;

/** Strictly validate a deployed Apps Script Web App URL (https, script.google.com, /exec). */
export function isValidWebAppUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL((raw || '').trim());
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.hostname === 'script.google.com' &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    WEB_APP_PATH.test(url.pathname)
  );
}

export interface BridgeCredentials {
  url: string;
  token: string;
}

type BridgeResponse = Record<string, unknown> & { status?: string; message?: string; code?: string };

class BridgeError extends Error {
  constructor(message: string, readonly kind: 'timeout' | 'http' | 'network' | 'bridge' | 'config') {
    super(message);
    this.name = 'BridgeError';
  }
}

async function postToBridge(
  { url, token }: BridgeCredentials,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<BridgeResponse> {
  const cleanUrl = (url || '').trim();
  if (!isValidWebAppUrl(cleanUrl)) {
    throw new BridgeError(
      'Invalid URL. It must be a published Google Apps Script Web App URL (https://script.google.com/macros/s/…/exec).',
      'config'
    );
  }
  if (!token || !token.trim()) {
    throw new BridgeError('Bridge token is missing. Run setupToken() in Apps Script and paste the token in Settings.', 'config');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(cleanUrl, {
      method: 'POST',
      // text/plain keeps this a CORS "simple request" (no preflight, which Apps Script cannot answer).
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: token.trim() }),
      redirect: 'follow',
      credentials: 'omit',
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new BridgeError(`Request timed out (${Math.round(timeoutMs / 1000)}s).`, 'timeout');
    }
    throw new BridgeError(err instanceof Error ? err.message : 'Network error', 'network');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new BridgeError(`HTTP ${response.status} from Google Apps Script`, 'http');
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new BridgeError(
      'Google returned a non-JSON page. Check that "Who has access" is set to "Anyone" and that you deployed a new version.',
      'bridge'
    );
  }
  if (typeof data !== 'object' || data === null) {
    throw new BridgeError('Unexpected response from bridge', 'bridge');
  }
  const res = data as BridgeResponse;
  if (res.status !== 'success') {
    throw new BridgeError(typeof res.message === 'string' ? res.message : 'Bridge returned an error', 'bridge');
  }
  return res;
}

function describe(err: unknown): string {
  if (err instanceof BridgeError && err.kind === 'timeout') {
    return `${err.message} The most common cause is "Who has access" set to "Only myself" instead of "Anyone", which makes Google redirect to a login page.`;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

export async function testGoogleSheetsConnection(
  creds: BridgeCredentials
): Promise<{ success: boolean; message: string }> {
  if ((creds.url || '').trim().endsWith('/dev')) {
    return {
      success: false,
      message: 'This is a test URL ending in /dev. You must use the published Web App URL ending in /exec.',
    };
  }
  try {
    const res = await postToBridge(creds, { action: 'ping' }, 8000);
    const extra = typeof res.sheetTitle === 'string' ? ` ("${res.sheetTitle}")` : '';
    return { success: true, message: `Connected to Google Sheets successfully${extra}!` };
  } catch (err) {
    return { success: false, message: describe(err) };
  }
}

export async function pullEntriesFromGoogleSheets(
  creds: BridgeCredentials
): Promise<{ success: boolean; entries: TotemEntry[]; message?: string }> {
  try {
    const res = await postToBridge(creds, { action: 'pull_entries' }, 10000);
    const entries = filterValidEntries(res.entries, 'Google Sheets pull');
    return {
      success: true,
      entries,
      message: `Retrieved ${entries.length} totems from Google Sheet.`,
    };
  } catch (err) {
    return { success: false, entries: [], message: describe(err) };
  }
}

export async function syncEntriesToGoogleSheets(
  creds: BridgeCredentials,
  entries: TotemEntry[]
): Promise<{ success: boolean; syncedIds: string[]; error?: string }> {
  if (entries.length === 0) {
    return { success: true, syncedIds: [] };
  }
  try {
    const res = await postToBridge(
      creds,
      {
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
          updatedAt: e.updatedAt,
          deleted: e.deleted === true,
        })),
      },
      15000
    );
    const syncedIds = Array.isArray(res.syncedIds) ? res.syncedIds.filter((id): id is string => typeof id === 'string') : [];
    return { success: true, syncedIds };
  } catch (err) {
    return { success: false, syncedIds: [], error: describe(err) };
  }
}
