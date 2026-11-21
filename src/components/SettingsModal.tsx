import React, { useState } from "react";
import { X, ShieldCheck, Key, RefreshCw, Cpu, Check } from "lucide-react";
import { getCustomApiKey, setCustomApiKey, getFirebaseConfig } from "../services/firebase";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
}) => {
  const currentConfig = getFirebaseConfig();
  const [apiKeyInput, setApiKeyInput] = useState(getCustomApiKey());
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setCustomApiKey(apiKeyInput);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onConfigUpdated();
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[#FAF9F6] border border-[#DCD6C9] rounded-2xl max-w-xl w-full p-6 paper-shadow relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E6E1D6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F6EDE8] text-[#C85A32] flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-editorial-serif text-lg font-bold text-[#1A1918]">
                Firebase & AI Runtime Settings
              </h3>
              <p className="text-xs text-[#797670]">
                Weave Hybrid AI Logic Architecture • Milestone 1
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#EAE5DA] text-[#797670] hover:text-[#1A1918] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4">
          {/* API Key Configuration */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4A4844] mb-1.5">
              Gemini Developer API Key / Firebase Key
            </label>
            <div className="relative">
              <input
                type="text"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-[#DCD6C9] bg-white focus:outline-none focus:border-[#C85A32] transition"
              />
            </div>
            <p className="text-[11px] text-[#797670] mt-1">
              Loaded from <code className="bg-[#EAE5DA] px-1 py-0.5 rounded text-[10px]">VITE_FIREBASE_API_KEY</code> or your temporary browser session.
            </p>
          </div>

          {/* Firebase Project Info */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E6E1D6] space-y-2 text-xs">
            <div className="font-semibold text-[#1A1918] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#3FA264]" />
              <span>Firebase Environment Parameters</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#4A4844]">
              <div>
                <span className="text-[#797670]">Project ID:</span> {currentConfig.projectId}
              </div>
              <div>
                <span className="text-[#797670]">App ID:</span> {currentConfig.appId.slice(0, 14)}...
              </div>
              <div>
                <span className="text-[#797670]">App Check Token:</span>{" "}
                <span className="text-[#2E5E3E] font-semibold">Debug Active</span>
              </div>
              <div>
                <span className="text-[#797670]">Inference Mode:</span>{" "}
                <span className="text-[#C85A32] font-semibold">PREFER_ON_DEVICE</span>
              </div>
            </div>
          </div>

          {/* Chrome Gemini Nano Instructions */}
          <div className="p-3.5 rounded-xl bg-[#FAF0EC] border border-[#E9CABE] text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-[#A54420]">
              <Cpu className="w-4 h-4" />
              <span>How to Enable Chrome Gemini Nano On-Device</span>
            </div>
            <p className="text-[11px] text-[#4A4844] leading-relaxed">
              To execute inferences 100% on-device with zero cloud latency and total offline capability in Chrome Canary or Chrome 128+:
            </p>
            <ol className="list-decimal list-inside text-[11px] text-[#4A4844] space-y-1 font-mono">
              <li>
                Set <span className="bg-white/80 px-1 py-0.2 rounded border border-[#E9CABE]">chrome://flags/#optimization-guide-on-device-model</span> to <strong>Enabled BypassPrefRequirement</strong>.
              </li>
              <li>
                Set <span className="bg-white/80 px-1 py-0.2 rounded border border-[#E9CABE]">chrome://flags/#prompt-api-for-gemini-nano</span> to <strong>Enabled</strong>.
              </li>
              <li>
                Visit <span className="bg-white/80 px-1 py-0.2 rounded border border-[#E9CABE]">chrome://components</span> and click <strong>Check for update</strong> on Optimization Guide On Device Model.
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#E6E1D6] flex items-center justify-between">
          <div className="text-[11px] text-[#797670] flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            <span>Zero build restarts needed</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[#DCD6C9] hover:bg-[#EAE5DA] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[#C85A32] text-white hover:bg-[#A54420] transition flex items-center gap-1.5"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
