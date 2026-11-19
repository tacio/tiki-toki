import React, { useState } from 'react';
import { useTimeTracker } from '../context/TimeTrackerContext';
import {
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  testGoogleSheetsConnection
} from '../services/googleSheets';
import { exportEntriesToCSV, exportEntriesToJSON } from '../services/storage';
import {
  X,
  FileSpreadsheet,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Download,
  AlertCircle,
  HelpCircle,
  Command,
  Save,
  CheckCircle2,
  Smartphone,
  CloudDownload
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMobileConnect?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenMobileConnect,
}) => {
  const { settings, updateAppSettings, entries, triggerSync, pullFromSheet, isSyncing } = useTimeTracker();

  const [webAppUrl, setWebAppUrl] = useState(settings.googleWebAppUrl || '');
  const [autoSync, setAutoSync] = useState(settings.autoSync);
  const [testingConnection, setTestingConnection] = useState(false);
  const [pullingCloud, setPullingCloud] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showScriptDrawer, setShowScriptDrawer] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleTestConnection = async () => {
    if (!webAppUrl.trim()) {
      setTestResult({
        success: false,
        message: 'Please paste your Google Apps Script Web App URL first.',
      });
      return;
    }

    setTestingConnection(true);
    setTestResult(null);

    const res = await testGoogleSheetsConnection(webAppUrl.trim());
    setTestingConnection(false);
    setTestResult(res);
  };

  const handlePullFromSheet = async () => {
    if (!webAppUrl.trim()) return;
    setPullingCloud(true);
    await pullFromSheet(webAppUrl.trim());
    setPullingCloud(false);
    setTestResult({
      success: true,
      message: 'Pulled latest totems from Google Spreadsheet into local ledger!',
    });
  };

  const handleSaveSettings = () => {
    updateAppSettings({
      ...settings,
      googleWebAppUrl: webAppUrl.trim(),
      autoSync,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleExportCSV = () => {
    const csv = exportEntriesToCSV(entries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiki-toki-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const json = exportEntriesToJSON(entries);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiki-toki-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-tiki-card border border-tiki-border p-5 sm:p-7 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-tiki-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-toki-950 border border-toki-800 text-toki-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Tiki-Toki Settings
              </h3>
              <p className="text-xs text-slate-400">
                Google Sheets synchronization and data preferences
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

        {/* SECTION 1: Google Sheets Setup */}
        <div className="space-y-4 rounded-xl bg-slate-900/70 border border-slate-800 p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Google Spreadsheet Repository</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                All time sinks and totems sync directly to your personal Google Sheet
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowScriptDrawer(!showScriptDrawer)}
              className="text-xs text-toki-400 hover:text-toki-300 font-medium underline flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showScriptDrawer ? 'Hide Script Guide' : '1-Min Setup Guide'}</span>
            </button>
          </div>

          {/* Setup Guide Accordion */}
          {showScriptDrawer && (
            <div className="rounded-xl bg-slate-950 border border-toki-900/60 p-4 text-xs space-y-3">
              <div className="font-semibold text-slate-200">
                How to connect in 60 seconds (Zero Cloud Console needed):
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-400 leading-relaxed">
                <li>Create a new spreadsheet at <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-toki-400 underline inline-flex items-center gap-0.5">sheets.new <ExternalLink className="w-2.5 h-2.5" /></a></li>
                <li>In Google Sheets menu, click <strong className="text-slate-200">Extensions &gt; Apps Script</strong></li>
                <li>Replace whatever is there with the script below, and click <strong className="text-slate-200">Save</strong> (disk icon)</li>
                <li>Click <strong className="text-slate-200">Deploy &gt; New deployment</strong>, select type <strong className="text-slate-200">Web app</strong></li>
                <li>Set <strong className="text-slate-200">Execute as: Me</strong> and <strong className="text-slate-200">Who has access: Anyone</strong> (CRITICAL)</li>
                <li>Click <strong className="text-slate-200">Deploy</strong>. When asked to authorize:
                  <div className="my-1.5 ml-4 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-[11px] space-y-1">
                    <p className="font-semibold text-amber-300">⚠️ If Google says "Google hasn't verified this app":</p>
                    <p>1. Click <strong className="text-white">"Advanced"</strong> (small link at bottom-left).</p>
                    <p>2. Click <strong className="text-white">"Go to Untitled project / Tiki-Toki Bridge (unsafe)"</strong>.</p>
                    <p>3. Click <strong className="text-white">"Allow"</strong>.</p>
                    <p className="text-slate-400 text-[10px] italic">(Google shows this for all personal scripts that access sheets. It is your own private script running on your own account.)</p>
                  </div>
                </li>
                <li>Copy the Web app URL (ends in <code className="text-amber-300">/exec</code>), paste it into the field below, and click <strong className="text-slate-200">Save Configuration</strong>!</li>
              </ol>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500 font-mono">apps-script-bridge.js</span>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-toki-600 hover:bg-toki-500 text-white font-medium transition-all"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-amber-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Script Copied!' : 'Copy Script Code'}</span>
                </button>
              </div>

              <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 max-h-40 overflow-y-auto">
                {GOOGLE_APPS_SCRIPT_TEMPLATE}
              </pre>
            </div>
          )}

          {/* Web App URL Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Google Apps Script Web App URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={webAppUrl}
                onChange={e => setWebAppUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-600 font-mono focus:outline-none focus:border-toki-500"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !webAppUrl.trim()}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 shrink-0 transition-all disabled:opacity-50"
                  title="Test GET/POST ping"
                >
                  {testingConnection ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-toki-400" />
                  ) : (
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>Test Ping</span>
                </button>

                <button
                  type="button"
                  onClick={handlePullFromSheet}
                  disabled={pullingCloud || !webAppUrl.trim()}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/80 flex items-center justify-center gap-1.5 shrink-0 transition-all disabled:opacity-50"
                  title="Pull all existing totems from Google Sheet"
                >
                  <CloudDownload className={`w-3.5 h-3.5 ${pullingCloud ? 'animate-bounce' : 'text-emerald-400'}`} />
                  <span>Pull Sheet Data</span>
                </button>
              </div>
            </div>
          </div>

          {/* Test Result Message */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/40 border-red-800 text-red-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Auto-Sync Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div>
              <div className="text-xs font-semibold text-white">Auto-Sync on Log</div>
              <div className="text-[11px] text-slate-400">
                Immediately send totems to Google Sheets when dropped or recorded
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={e => setAutoSync(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-toki-600"></div>
            </label>
          </div>

        </div>

        {/* SECTION 2: Mobile Access & QR Code */}
        {onOpenMobileConnect && (
          <div className="rounded-xl bg-toki-950/40 border border-toki-900/50 p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-toki-400" />
                <span>Connect Phone (Same Wi-Fi)</span>
              </h4>
              <p className="text-xs text-slate-400">
                Scan QR code to open Tiki-Toki on your phone with settings pre-configured
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMobileConnect();
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-toki-600 hover:bg-toki-500 text-white shadow-md shadow-toki-950 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>Show QR Code</span>
            </button>
          </div>
        )}

        {/* SECTION 3: Data Backup & Exports */}
        <div className="space-y-3 rounded-xl bg-slate-900/70 border border-slate-800 p-4 sm:p-5">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-toki-400" />
              <span>Offline Local Data & Backups</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Your entries are always stored locally in your browser cache ({entries.length} totems stored)
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV (Spreadsheet)</span>
            </button>

            <button
              type="button"
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-toki-400" />
              <span>Export JSON Backup</span>
            </button>
          </div>
        </div>

        {/* SECTION 4: Keyboard Shortcuts Cheatsheet */}
        <div className="rounded-xl bg-slate-900/50 border border-slate-800/80 p-4 text-xs space-y-2">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Command className="w-3.5 h-3.5 text-toki-400" />
            <span>Keyboard Shortcuts</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-400 font-mono text-[11px] pt-1">
            <div className="flex items-center justify-between p-1.5 rounded bg-slate-950 border border-slate-800">
              <span>Space</span>
              <span className="text-slate-200">Start / Pause</span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-slate-950 border border-slate-800">
              <span>Enter</span>
              <span className="text-slate-200">Drop Totem</span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-slate-950 border border-slate-800">
              <span>R</span>
              <span className="text-slate-200">Log Past</span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-slate-950 border border-slate-800">
              <span>1</span>
              <span className="text-emerald-400">Productive</span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-slate-950 border border-slate-800">
              <span>2</span>
              <span className="text-amber-400">Upkeep</span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-slate-950 border border-slate-800">
              <span>3</span>
              <span className="text-red-400">Time Sink</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-tiki-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSaveSettings}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-toki-600 hover:bg-toki-500 text-white shadow-lg shadow-toki-900/40 transition-all active:scale-95"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-amber-300" />
                <span>Settings Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
