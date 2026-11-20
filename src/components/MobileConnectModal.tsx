import React, { useEffect, useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import QRCode from 'qrcode';
import { X, Smartphone, QrCode, Copy, Check, RefreshCw, Sparkles, ShieldAlert } from 'lucide-react';

interface MobileConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileConnectModal: React.FC<MobileConnectModalProps> = ({ isOpen, onClose }) => {
  const { settings, pullFromSheet, isSyncing } = useTimeTracker();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [pulledSuccess, setPulledSuccess] = useState(false);

  const { hostname, protocol, origin, pathname } = window.location;
  const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  const isInsecure = protocol !== 'https:' && !isLoopback;
  const appUrl = `${origin}${pathname}`;

  // The Web App URL goes in the query string; the token goes in the #fragment,
  // which browsers never send to any server. The app strips both on load and
  // asks for confirmation before using them.
  const syncParam = settings.googleWebAppUrl ? `?syncUrl=${encodeURIComponent(settings.googleWebAppUrl)}` : '';
  const tokenFragment = settings.googleWebAppUrl && settings.googleBridgeToken
    ? `#t=${encodeURIComponent(settings.googleBridgeToken)}`
    : '';
  const mobileUrl = `${appUrl}${syncParam}${tokenFragment}`;

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(mobileUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#0f141c',
          light: '#ffffff',
        },
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Error generating QR code', err));
    }
  }, [isOpen, mobileUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    void navigator.clipboard.writeText(mobileUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePull = async () => {
    await pullFromSheet();
    setPulledSuccess(true);
    setTimeout(() => setPulledSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-tiki-card border border-tiki-border p-5 sm:p-7 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-tiki-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-toki-950 border border-toki-800 text-toki-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Access on Mobile</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Instant Sync
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Scan with your phone to open and auto-sync in seconds
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Card */}
        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-3">
          {qrDataUrl ? (
            <div className="p-3 bg-white rounded-xl shadow-lg shadow-black/50">
              <img
                src={qrDataUrl}
                alt="Scan to open on phone"
                className="w-48 h-48 sm:w-56 sm:h-56 block rounded-lg"
              />
            </div>
          ) : (
            <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl bg-slate-800 flex items-center justify-center animate-pulse">
              <QrCode className="w-12 h-12 text-slate-500" />
            </div>
          )}

          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Scan with your phone camera</span>
            </div>
            <p className="text-[11px] text-slate-400 max-w-xs">
              Opens Tiki-Toki and offers to connect it to your Google Spreadsheet bridge.
            </p>
          </div>
        </div>

        {tokenFragment && (
          <div className="flex gap-2 p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-200">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-300" />
            <span>This QR code and link contain your bridge token. Treat them like a password and don't share screenshots of them.</span>
          </div>
        )}

        {isLoopback && (
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-[11px] text-slate-300">
            You're on <code>localhost</code>, which your phone can't reach. Open the deployed HTTPS site, or run{' '}
            <code className="text-slate-100">npm run dev:lan</code> and open this page through your computer's LAN address.
          </div>
        )}

        {isInsecure && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-[11px] text-red-200">
            This page is served over plain HTTP. Anyone on the same network can tamper with it. Prefer the deployed HTTPS site.
          </div>
        )}

        {/* Direct Link Box */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Direct Mobile URL:
          </label>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800">
            <span className="flex-1 font-mono text-xs text-toki-300 truncate px-1">
              {appUrl}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-all active:scale-95 shrink-0"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Step by Step Instructions */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-4 text-xs space-y-2 text-slate-300">
          <div className="font-semibold text-white">Quick Steps:</div>
          <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
            <li>Scan the QR code with your camera app or open the link in Safari / Chrome.</li>
            <li>Confirm the <strong className="text-slate-200">"Connect to this Google Sheet?"</strong> prompt that appears.</li>
            <li>Tap <strong className="text-slate-200">"Add to Home Screen"</strong> in your phone browser to install it as an app icon.</li>
          </ul>
        </div>

        {/* Pull / Refresh From Cloud Action */}
        <div className="pt-2 flex items-center justify-between border-t border-tiki-border">
          <button
            type="button"
            onClick={handlePull}
            disabled={isSyncing || !settings.googleWebAppUrl}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-toki-400' : 'text-emerald-400'}`} />
            <span>{isSyncing ? 'Pulling...' : pulledSuccess ? 'Synced with Sheet!' : 'Pull from Google Sheet'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-toki-600 hover:bg-toki-500 text-white transition-all active:scale-95"
          >
            Got It
          </button>
        </div>

      </div>
    </div>
  );
};
