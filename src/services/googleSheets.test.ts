import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  isValidWebAppUrl,
  pullEntriesFromGoogleSheets,
  syncEntriesToGoogleSheets,
  testGoogleSheetsConnection,
} from './googleSheets';
import { makeEntry, TOKEN, VALID_URL } from '../test/factories';

const creds = { url: VALID_URL, token: TOKEN };

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('isValidWebAppUrl', () => {
  it.each([
    VALID_URL,
    'https://script.google.com/a/macros/example.com/s/AKfy-123_x/exec',
    `  ${VALID_URL}  `,
  ])('accepts %s', url => expect(isValidWebAppUrl(url)).toBe(true));

  it.each([
    '',
    'not a url',
    'http://script.google.com/macros/s/abc/exec',
    'https://script.google.com/macros/s/abc/dev',
    'https://script.google.com.evil.com/macros/s/abc/exec',
    'https://evil.com/https://script.google.com/macros/s/abc/exec',
    'https://user:pw@script.google.com/macros/s/abc/exec',
    'https://script.google.com:8443/macros/s/abc/exec',
    'https://script.google.com/macros/s/abc/exec/../../evil',
    'javascript:alert(1)//script.google.com/macros/s/abc/exec',
  ])('rejects %s', url => expect(isValidWebAppUrl(url)).toBe(false));
});

describe('GOOGLE_APPS_SCRIPT_TEMPLATE', () => {
  it('is the token-protected bridge source', () => {
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('function doPost');
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('function setupToken');
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('isAuthorized');
  });
});

describe('testGoogleSheetsConnection', () => {
  it('flags /dev URLs without any network call', async () => {
    const res = await testGoogleSheetsConnection({ url: VALID_URL.replace('/exec', '/dev'), token: TOKEN });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/\/dev/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a token', async () => {
    const res = await testGoogleSheetsConnection({ url: VALID_URL, token: '  ' });
    expect(res).toMatchObject({ success: false, message: expect.stringMatching(/token is missing/i) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pings with the token in a text/plain POST body (no preflight, no credentials)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'success', sheetTitle: 'Log' }));
    const res = await testGoogleSheetsConnection(creds);

    expect(res).toEqual({ success: true, message: 'Connected to Google Sheets successfully ("Log")!' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(VALID_URL);
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    expect(JSON.parse(init.body)).toEqual({ action: 'ping', token: TOKEN });
  });

  it('surfaces bridge errors such as a wrong token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'error', message: 'Unauthorized: bridge token missing or incorrect' }));
    expect(await testGoogleSheetsConnection(creds)).toEqual({
      success: false,
      message: 'Unauthorized: bridge token missing or incorrect',
    });
  });

  it('explains non-JSON responses (login redirect page)', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Sign in</html>', { status: 200 }));
    const res = await testGoogleSheetsConnection(creds);
    expect(res.message).toMatch(/non-JSON/);
  });

  it('times out after 8s with a helpful hint', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })
    );
    const pending = testGoogleSheetsConnection(creds);
    await vi.advanceTimersByTimeAsync(8000);
    const res = await pending;
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/timed out \(8s\).*Anyone/);
  });

  it('reports HTTP errors', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    expect((await testGoogleSheetsConnection(creds)).message).toBe('HTTP 500 from Google Apps Script');
  });

  it('reports network errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await testGoogleSheetsConnection(creds)).message).toBe('Failed to fetch');
  });
});

describe('pullEntriesFromGoogleSheets', () => {
  it('never calls an invalid URL', async () => {
    const res = await pullEntriesFromGoogleSheets({ url: 'https://evil.example/exec', token: TOKEN });
    expect(res.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns only well-formed entries', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const good = makeEntry({ syncStatus: 'synced' });
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'success', entries: [good, { id: 'evil', title: { toString: 'x' } }, 'junk'] })
    );
    const res = await pullEntriesFromGoogleSheets(creds);
    expect(res.success).toBe(true);
    expect(res.entries).toEqual([good]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'pull_entries', token: TOKEN });
  });

  it('handles a missing entries array', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue(jsonResponse({ status: 'success' }));
    expect(await pullEntriesFromGoogleSheets(creds)).toMatchObject({ success: true, entries: [] });
  });
});

describe('syncEntriesToGoogleSheets', () => {
  it('is a no-op for an empty batch', async () => {
    expect(await syncEntriesToGoogleSheets(creds, [])).toEqual({ success: true, syncedIds: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends entries including updatedAt and deleted flags', async () => {
    const entry = makeEntry({ id: 'e1', deleted: true });
    fetchMock.mockResolvedValue(jsonResponse({ status: 'success', syncedIds: ['e1', 42] }));

    const res = await syncEntriesToGoogleSheets(creds, [entry]);
    expect(res).toEqual({ success: true, syncedIds: ['e1'] });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ action: 'sync_entries', token: TOKEN });
    expect(body.entries[0]).toMatchObject({ id: 'e1', deleted: true, updatedAt: entry.updatedAt });
    expect(body.entries[0]).not.toHaveProperty('syncStatus');
  });

  it('returns an error result on failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'error', message: 'Too many entries in one request' }));
    expect(await syncEntriesToGoogleSheets(creds, [makeEntry()])).toEqual({
      success: false,
      syncedIds: [],
      error: 'Too many entries in one request',
    });
  });
});
