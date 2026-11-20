import React from 'react';
import { ShieldQuestion } from 'lucide-react';
import { useTimeTracker } from '../context/TimeTrackerContext';

/** Asks before adopting a Google Sheet connection that arrived via a shared link / QR code. */
export const ImportConfirmBanner: React.FC = () => {
  const { pendingImport, acceptImport, rejectImport, settings } = useTimeTracker();
  if (!pendingImport) return null;

  const deploymentId = pendingImport.url.split('/s/')[1]?.split('/')[0] ?? '';
  const shortId = deploymentId.length > 14 ? `${deploymentId.slice(0, 6)}…${deploymentId.slice(-6)}` : deploymentId;
  const replacing = settings.googleWebAppUrl && settings.googleWebAppUrl !== pendingImport.url;

  return (
    <div
      role="alertdialog"
      aria-labelledby="import-confirm-title"
      className="max-w-5xl w-full mx-auto px-4 pt-4 sm:px-6"
    >
      <div className="rounded-xl border border-amber-700/70 bg-amber-950/40 p-4 text-xs text-amber-100 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldQuestion className="w-5 h-5 text-amber-300 shrink-0" />
          <div className="space-y-1">
            <p id="import-confirm-title" className="font-semibold text-amber-200">
              Connect to this Google Sheet?
            </p>
            <p>
              A link wants to sync your time log to Apps Script deployment{' '}
              <code className="text-white">{shortId}</code>
              {pendingImport.token ? ' (token included)' : ' (no token; you will need to add it in Settings)'}.
              Only accept if you opened this link from your own Tiki-Toki.
            </p>
            {replacing && <p className="text-amber-300">This will replace your current sheet connection.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={rejectImport}
            className="px-3 py-1.5 rounded-lg font-medium text-slate-300 hover:bg-slate-800"
          >
            Ignore
          </button>
          <button
            type="button"
            onClick={acceptImport}
            className="px-3 py-1.5 rounded-lg font-semibold bg-amber-600 hover:bg-amber-500 text-white"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
};
