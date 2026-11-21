import React from "react";
import { Cpu, Download, CheckCircle2, AlertTriangle, ShieldCheck, Settings } from "lucide-react";
import type { OnDeviceModelStatus } from "../types/weave";

interface HeaderStatusBarProps {
  onDeviceStatus: OnDeviceModelStatus;
  downloadProgress: { loaded: number; total: number } | null;
  isDownloading: boolean;
  onTriggerDownload: () => void;
  onOpenSettings: () => void;
}

export const HeaderStatusBar: React.FC<HeaderStatusBarProps> = ({
  onDeviceStatus,
  downloadProgress,
  isDownloading,
  onTriggerDownload,
  onOpenSettings,
}) => {
  // Format live status text and badge styling
  const getStatusDisplay = () => {
    switch (onDeviceStatus) {
      case "available":
        return {
          label: "Available (Gemini Nano Ready)",
          className: "bg-[#EDF3EF] text-[#2E5E3E] border-[#C2DACB]",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#2E5E3E]" />,
          showDownload: false,
        };
      case "downloading":
        return {
          label: "Downloading Model...",
          className: "bg-[#EBF3FB] text-[#1E5692] border-[#C2DBF2]",
          icon: <Download className="w-3.5 h-3.5 text-[#1E5692] animate-bounce" />,
          showDownload: false,
        };
      case "downloadable":
        return {
          label: "Downloadable (Ready to Install)",
          className: "bg-[#FFF4E5] text-[#975A16] border-[#FBD38D]",
          icon: <Download className="w-3.5 h-3.5 text-[#975A16]" />,
          showDownload: true,
        };
      case "unavailable":
      default:
        return {
          label: "Cloud Fallback Active",
          className: "bg-[#F7F4EF] text-[#797670] border-[#E2DDD3]",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-[#9E9A90]" />,
          showDownload: true, // Allow user to click to test or trigger if modern flags enabled
        };
    }
  };

  const statusInfo = getStatusDisplay();
  const downloadPercent =
    downloadProgress && downloadProgress.total > 0
      ? Math.round((downloadProgress.loaded / downloadProgress.total) * 100)
      : null;

  return (
    <header className="sticky top-0 z-30 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-[#E6E1D6] paper-shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#C85A32] text-white flex items-center justify-center font-editorial-serif text-xl font-bold shadow-sm">
            W
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-editorial-serif text-lg font-bold tracking-tight text-[#1A1918]">
                WEAVE
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#FAF0EC] text-[#C85A32] font-semibold border border-[#E9CABE]">
                #BuildHybridAI 2026
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#FAF9F6] text-[#797670] border border-[#E6E1D6]">
                Milestone 1
              </span>
            </div>
            <p className="text-xs text-[#797670] hidden sm:block">
              Hybrid On-Device & Cloud Spatial Research • Firebase AI Logic Verification Workbench
            </p>
          </div>
        </div>

        {/* Status Indicators & Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* App Check Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-white border border-[#E6E1D6] text-[#4A4844] paper-shadow"
            title="Firebase App Check enabled with debug token support"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#3FA264]" />
            <span className="hidden md:inline">App Check:</span>
            <span className="text-[#2E5E3E] font-semibold">Active</span>
          </div>

          {/* Chrome Gemini Nano Live Status */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border paper-shadow ${statusInfo.className}`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">Nano:</span>
            <span>{statusInfo.label}</span>
            {downloadPercent !== null && (
              <span className="font-mono text-[10px] ml-1 bg-white/70 px-1.5 py-0.2 rounded font-bold">
                {downloadPercent}%
              </span>
            )}
          </div>

          {/* Trigger On-Device Model Download Button */}
          {statusInfo.showDownload && (
            <button
              onClick={onTriggerDownload}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-[#C85A32] text-white hover:bg-[#A54420] transition disabled:opacity-50 shadow-sm cursor-pointer"
              title="Trigger Chrome Prompt API window.LanguageModel.create() with progress monitoring"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? "Downloading..." : "Download Nano"}</span>
            </button>
          )}

          {/* Settings Modal Toggle */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg border border-[#E6E1D6] bg-white text-[#4A4844] hover:text-[#1A1918] hover:border-[#C85A32] transition paper-shadow cursor-pointer"
            title="Configure Firebase Keys & App Check Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar for On-Device Model Download */}
      {isDownloading && downloadPercent !== null && (
        <div className="w-full bg-[#E6E1D6] h-1 overflow-hidden">
          <div
            className="bg-[#C85A32] h-full transition-all duration-300"
            style={{ width: `${downloadPercent}%` }}
          />
        </div>
      )}
    </header>
  );
};
