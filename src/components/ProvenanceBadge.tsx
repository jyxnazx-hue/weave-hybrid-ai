import React from "react";
import { Cpu, Cloud, HelpCircle } from "lucide-react";
import type { InferenceSource } from "../types/weave";

interface ProvenanceBadgeProps {
  source: InferenceSource;
  size?: "sm" | "md" | "lg";
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({ source, size = "md" }) => {
  if (source === "ON_DEVICE") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#EDF3EF] text-[#2E5E3E] border border-[#C2DACB] ${
          size === "sm" ? "px-2 py-0.5 text-xs" : size === "lg" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
        }`}
        title="Inference executed locally on device via Chrome Gemini Nano (zero cloud latency, total privacy)"
      >
        <Cpu className={size === "sm" ? "w-3 h-3 text-[#2E5E3E]" : "w-3.5 h-3.5 text-[#2E5E3E]"} />
        <span>ON_DEVICE (Nano)</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#3FA264] animate-pulse" />
      </span>
    );
  }

  if (source === "IN_CLOUD") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#F6EDE8] text-[#A54420] border border-[#E9CABE] ${
          size === "sm" ? "px-2 py-0.5 text-xs" : size === "lg" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
        }`}
        title="Inference executed in Google Cloud via Gemini 3.5 Flash"
      >
        <Cloud className={size === "sm" ? "w-3 h-3 text-[#C85A32]" : "w-3.5 h-3.5 text-[#C85A32]"} />
        <span>IN_CLOUD (Gemini 3.5 Flash)</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-[#F0EDE6] text-[#69655D] border border-[#DCD6C9] ${
        size === "sm" ? "px-2 py-0.5 text-xs" : size === "lg" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
      }`}
    >
      <HelpCircle className={size === "sm" ? "w-3 h-3 text-[#797670]" : "w-3.5 h-3.5 text-[#797670]"} />
      <span>HYBRID / UNKNOWN</span>
    </span>
  );
};
