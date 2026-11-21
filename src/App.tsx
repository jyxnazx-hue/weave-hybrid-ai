import React, { useState, useEffect, useRef } from "react";
import {
  Scissors,
  Eye,
  Layers,
  ShieldAlert,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Plus,
  RefreshCw,
  Clock,
  Code2,
} from "lucide-react";

import {
  extractConceptNode,
  generateJargonXRay,
  generateMicroFlow,
  redactSensitiveText,
  synthesizeWeaveBrief,
  extractDiagramFromImage,
  checkOnDeviceStatus,
  triggerOnDeviceDownload,
} from "./services/aiRouter";

import type {
  WeaveNode,
  WeaveBriefResult,
  ExtractConceptResult,
  JargonXRayResult,
  MicroFlowResult,
  RedactResult,
  OnDeviceModelStatus,
  InferenceSource,
} from "./types/weave";

import {
  getStoredNodes,
  saveStoredNodes,
  getStoredBriefs,
  saveStoredBriefs,
} from "./services/storage";

import {
  SAMPLE_TEXTS,
  SAMPLE_DIAGRAM_BASE64,
  INITIAL_PRESET_NODES,
} from "./services/sampleData";

import { HeaderStatusBar } from "./components/HeaderStatusBar";
import { ProvenanceBadge } from "./components/ProvenanceBadge";
import { MicroFlowViewer } from "./components/MicroFlowViewer";
import { WorkingNodesPanel } from "./components/WorkingNodesPanel";
import { SettingsModal } from "./components/SettingsModal";

type ActiveTab = "consensus" | "quantum" | "long" | "sensitive" | "diagram" | "custom";

interface ActiveOutput {
  actionType: "concept" | "xray" | "microflow" | "redact" | "brief" | "diagram";
  actionLabel: string;
  source: InferenceSource;
  latencyMs: number;
  data:
    | ExtractConceptResult
    | JargonXRayResult
    | MicroFlowResult
    | RedactResult
    | WeaveBriefResult
    | {
        coreClaim: string;
        role: string;
        entities: string[];
        microFlow: any;
      };
  rawJson: string;
}

export function App() {
  // Input and tab states
  const [activeTab, setActiveTab] = useState<ActiveTab>("consensus");
  const [inputText, setInputText] = useState<string>(SAMPLE_TEXTS.distributedConsensus);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/png");

  // AI execution states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentActionLabel, setCurrentActionLabel] = useState<string | null>(null);
  const [activeOutput, setActiveOutput] = useState<ActiveOutput | null>(null);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Chrome Gemini Nano live status states
  const [onDeviceStatus, setOnDeviceStatus] = useState<OnDeviceModelStatus>("unavailable");
  const [downloadProgress, setDownloadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Working nodes collection
  const [savedNodes, setSavedNodes] = useState<WeaveNode[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [isSynthesizingBrief, setIsSynthesizingBrief] = useState<boolean>(false);

  // Settings modal
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial load: check live on-device status and retrieve saved nodes
  useEffect(() => {
    let mounted = true;

    async function initEnvironment() {
      const status = await checkOnDeviceStatus();
      if (mounted) {
        setOnDeviceStatus(status);
      }

      const stored = await getStoredNodes();
      if (mounted) {
        if (stored && stored.length > 0) {
          setSavedNodes(stored);
          setSelectedNodeIds(stored.slice(0, 3).map((n) => n.id));
        } else {
          setSavedNodes(INITIAL_PRESET_NODES);
          setSelectedNodeIds(INITIAL_PRESET_NODES.map((n) => n.id));
          await saveStoredNodes(INITIAL_PRESET_NODES);
        }
      }
    }

    initEnvironment();
    return () => {
      mounted = false;
    };
  }, []);

  // Save nodes to IndexedDB on changes
  useEffect(() => {
    if (savedNodes.length > 0) {
      saveStoredNodes(savedNodes);
    }
  }, [savedNodes]);

  // Handle Preset Switching
  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSelectedImage(null);
    switch (tab) {
      case "consensus":
        setInputText(SAMPLE_TEXTS.distributedConsensus);
        break;
      case "quantum":
        setInputText(SAMPLE_TEXTS.quantumPhysics);
        break;
      case "long":
        setInputText(SAMPLE_TEXTS.longPaperExcerpt);
        break;
      case "sensitive":
        setInputText(SAMPLE_TEXTS.sensitiveLog);
        break;
      case "diagram":
        setInputText("Architecture schematic showing three-tiered client, on-device Nano, and cloud Flash routing.");
        setSelectedImage(SAMPLE_DIAGRAM_BASE64);
        setImageMimeType("image/svg+xml");
        break;
      case "custom":
        setInputText("");
        break;
    }
  };

  // Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageMimeType(file.type || "image/png");
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      setSelectedImage(resultStr);
      setActiveTab("diagram");
      setInputText(`Uploaded image: ${file.name} (${Math.round(file.size / 1024)} KB)`);
    };
    reader.readAsDataURL(file);
  };

  // Trigger on-device model download
  const handleTriggerDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress({ loaded: 0, total: 100 });
    try {
      const success = await triggerOnDeviceDownload((loaded, total) => {
        setDownloadProgress({ loaded, total });
      });
      if (success) {
        setOnDeviceStatus("available");
      }
    } catch (err) {
      console.error("On-device download error:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  // ==========================================
  // Router Action 1: Clip Concept (PREFER_ON_DEVICE)
  // ==========================================
  const handleActionClipConcept = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setCurrentActionLabel("Clipping Concept Node (PREFER_ON_DEVICE)...");
    const startTime = performance.now();

    try {
      const res = await extractConceptNode(inputText);
      const elapsed = Math.round(performance.now() - startTime);

      setActiveOutput({
        actionType: "concept",
        actionLabel: "Concept Node Extraction",
        source: res.inferenceSource,
        latencyMs: elapsed,
        data: res,
        rawJson: JSON.stringify(res, null, 2),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setCurrentActionLabel(null);
    }
  };

  // Save extracted concept into Working Session
  const handleSaveConceptToSession = () => {
    if (!activeOutput || activeOutput.actionType !== "concept") return;
    const conceptData = activeOutput.data as ExtractConceptResult;
    const newNode: WeaveNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      rawText: inputText,
      coreClaim: conceptData.coreClaim,
      role: conceptData.role,
      entities: conceptData.entities,
      inferenceSource: activeOutput.source,
      createdAt: Date.now(),
    };
    setSavedNodes((prev) => [newNode, ...prev]);
    setSelectedNodeIds((prev) => [...prev, newNode.id]);
  };

  // ==========================================
  // Router Action 2: Jargon X-Ray (PREFER_ON_DEVICE)
  // ==========================================
  const handleActionJargonXRay = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setCurrentActionLabel("Generating Jargon X-Ray (PREFER_ON_DEVICE)...");
    const startTime = performance.now();

    try {
      const res = await generateJargonXRay(inputText);
      const elapsed = Math.round(performance.now() - startTime);

      setActiveOutput({
        actionType: "xray",
        actionLabel: "Jargon X-Ray Translation",
        source: res.inferenceSource,
        latencyMs: elapsed,
        data: res,
        rawJson: JSON.stringify(res, null, 2),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setCurrentActionLabel(null);
    }
  };

  // ==========================================
  // Router Action 3: 3-Box Micro-Flow (PREFER_ON_DEVICE)
  // ==========================================
  const handleActionMicroFlow = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setCurrentActionLabel("Extracting 3-Box Micro-Flow (PREFER_ON_DEVICE)...");
    const startTime = performance.now();

    try {
      const res = await generateMicroFlow(inputText);
      const elapsed = Math.round(performance.now() - startTime);

      setActiveOutput({
        actionType: "microflow",
        actionLabel: "3-Box Causal Micro-Flow",
        source: res.inferenceSource,
        latencyMs: elapsed,
        data: res,
        rawJson: JSON.stringify(res, null, 2),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setCurrentActionLabel(null);
    }
  };

  // ==========================================
  // Router Action 4: Local Privacy Redact (PREFER_ON_DEVICE)
  // ==========================================
  const handleActionPrivacyRedact = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setCurrentActionLabel("Running On-Device Privacy Redact (PREFER_ON_DEVICE)...");
    const startTime = performance.now();

    try {
      const res = await redactSensitiveText(inputText);
      const elapsed = Math.round(performance.now() - startTime);

      setActiveOutput({
        actionType: "redact",
        actionLabel: "Local Privacy Redaction",
        source: res.inferenceSource,
        latencyMs: elapsed,
        data: res,
        rawJson: JSON.stringify(res, null, 2),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setCurrentActionLabel(null);
    }
  };

  // ==========================================
  // Router Action 5: Cloud Weave Brief / Diagram Snip (ONLY_IN_CLOUD)
  // ==========================================
  const handleActionCloudSynthesisOrDiagram = async () => {
    // If an image is selected, test Diagram Snip
    if (selectedImage) {
      setIsProcessing(true);
      setCurrentActionLabel("Extracting Diagram Snip (ONLY_IN_CLOUD Multimodal)...");
      const startTime = performance.now();

      try {
        const res = await extractDiagramFromImage(selectedImage, imageMimeType);
        const elapsed = Math.round(performance.now() - startTime);

        setActiveOutput({
          actionType: "diagram",
          actionLabel: "Multimodal Diagram Snip",
          source: res.inferenceSource,
          latencyMs: elapsed,
          data: res,
          rawJson: JSON.stringify(res, null, 2),
        });
      } catch (err) {
        console.error(err);
      } finally {
        setIsProcessing(false);
        setCurrentActionLabel(null);
      }
      return;
    }

    // Otherwise synthesize Weave Brief from working nodes
    await handleSynthesizeBrief();
  };

  // Direct synthesis from Working Nodes Panel
  const handleSynthesizeBrief = async () => {
    const nodesToSynthesize = savedNodes.filter((n) => selectedNodeIds.includes(n.id));
    if (nodesToSynthesize.length < 2) {
      alert("Please select at least 3 nodes in the Working Nodes panel to synthesize a Weave Brief.");
      return;
    }

    setIsProcessing(true);
    setIsSynthesizingBrief(true);
    setCurrentActionLabel(`Synthesizing Cross-Source Brief (${nodesToSynthesize.length} Nodes • ONLY_IN_CLOUD)...`);
    const startTime = performance.now();

    try {
      const res = await synthesizeWeaveBrief(nodesToSynthesize);
      const elapsed = Math.round(performance.now() - startTime);

      setActiveOutput({
        actionType: "brief",
        actionLabel: `Weave Cross-Source Synthesis (${nodesToSynthesize.length} Nodes)`,
        source: res.inferenceSource,
        latencyMs: elapsed,
        data: res,
        rawJson: JSON.stringify(res, null, 2),
      });

      // Save to IndexedDB briefs
      const existingBriefs = await getStoredBriefs();
      await saveStoredBriefs([res, ...existingBriefs]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setIsSynthesizingBrief(false);
      setCurrentActionLabel(null);
    }
  };

  const handleCopyJson = () => {
    if (!activeOutput) return;
    navigator.clipboard.writeText(activeOutput.rawJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1200);
  };

  const charCount = inputText.length;
  const isOverLength = charCount > 1200;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1A1918] flex flex-col paper-texture">
      {/* Top Status Bar with Live Chrome Gemini Nano status */}
      <HeaderStatusBar
        onDeviceStatus={onDeviceStatus}
        downloadProgress={downloadProgress}
        isDownloading={isDownloading}
        onTriggerDownload={handleTriggerDownload}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* Intro Banner */}
        <section className="bg-white border border-[#E6E1D6] rounded-2xl p-5 paper-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-editorial-serif text-xl font-bold tracking-tight text-[#1A1918]">
                Milestone 1 Verification Workbench
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#FAF0EC] text-[#C85A32] font-semibold border border-[#E9CABE]">
                Firebase AI Logic SDK v13+
              </span>
            </div>
            <p className="text-xs text-[#797670] leading-relaxed max-w-3xl">
              Inspect on-device low-latency inference (<code className="font-mono text-[#2E5E3E]">PREFER_ON_DEVICE</code>) with automatic cloud fallback (<code className="font-mono text-[#C85A32]">ONLY_IN_CLOUD</code>) for spatial research synthesis.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
            <span className="text-[11px] font-mono text-[#797670] bg-[#FAF9F6] px-3 py-1.5 rounded-xl border border-[#E6E1D6]">
              Length Routing: <strong className={isOverLength ? "text-[#C85A32]" : "text-[#2E5E3E]"}>{charCount}</strong> / 1,200 chars
            </span>
          </div>
        </section>

        {/* 2-Column Core Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Input Panel & Router Actions (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Input Selection & Editor Card */}
            <div className="bg-white border border-[#E6E1D6] rounded-2xl p-5 paper-shadow space-y-4">
              {/* Presets Selector Tabs */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#F0EDE6]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#797670] mr-1">
                    Presets:
                  </span>
                  <button
                    onClick={() => handleSelectTab("consensus")}
                    className={`text-xs px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                      activeTab === "consensus"
                        ? "bg-[#FAF0EC] text-[#C85A32] border border-[#E9CABE] shadow-xs"
                        : "text-[#4A4844] hover:bg-[#FAF9F6]"
                    }`}
                  >
                    1. Consensus (850c)
                  </button>
                  <button
                    onClick={() => handleSelectTab("quantum")}
                    className={`text-xs px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                      activeTab === "quantum"
                        ? "bg-[#FAF0EC] text-[#C85A32] border border-[#E9CABE] shadow-xs"
                        : "text-[#4A4844] hover:bg-[#FAF9F6]"
                    }`}
                  >
                    2. Quantum (720c)
                  </button>
                  <button
                    onClick={() => handleSelectTab("long")}
                    className={`text-xs px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                      activeTab === "long"
                        ? "bg-[#FAF0EC] text-[#C85A32] border border-[#E9CABE] shadow-xs"
                        : "text-[#4A4844] hover:bg-[#FAF9F6]"
                    }`}
                    title="Excerpt > 1,200 chars triggers automatic cloudHeavyModel routing"
                  >
                    3. Long Paper (1,600c)
                  </button>
                  <button
                    onClick={() => handleSelectTab("sensitive")}
                    className={`text-xs px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                      activeTab === "sensitive"
                        ? "bg-[#FAF0EC] text-[#C85A32] border border-[#E9CABE] shadow-xs"
                        : "text-[#4A4844] hover:bg-[#FAF9F6]"
                    }`}
                    title="Contains private emails, API keys, and project codenames for privacy redaction test"
                  >
                    4. Privacy Log
                  </button>
                  <button
                    onClick={() => handleSelectTab("diagram")}
                    className={`text-xs px-2.5 py-1 rounded-lg transition font-medium cursor-pointer flex items-center gap-1 ${
                      activeTab === "diagram"
                        ? "bg-[#FAF0EC] text-[#C85A32] border border-[#E9CABE] shadow-xs"
                        : "text-[#4A4844] hover:bg-[#FAF9F6]"
                    }`}
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>5. Diagram</span>
                  </button>
                </div>

                {/* Upload Image button */}
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-medium text-[#4A4844] hover:text-[#C85A32] px-2.5 py-1 rounded-lg border border-[#E6E1D6] hover:border-[#C85A32] transition flex items-center gap-1 bg-white cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                  </button>
                </div>
              </div>

              {/* Text / Image Input Area */}
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    rows={7}
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      if (activeTab !== "custom") setActiveTab("custom");
                    }}
                    placeholder="Enter dense scientific, engineering, or conceptual text to analyze..."
                    className="w-full text-xs sm:text-sm font-editorial-serif leading-relaxed p-3.5 rounded-xl border border-[#DCD6C9] bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C85A32] transition text-[#1A1918] placeholder-[#A09D96]"
                  />

                  {/* Character count & Length routing indicator badge */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                        isOverLength
                          ? "bg-[#FDF3F2] text-[#A82B24] border-[#F5BEBA]"
                          : "bg-white text-[#2E5E3E] border-[#C2DACB]"
                      }`}
                    >
                      {charCount} chars {isOverLength ? "→ Auto Cloud (>1.2k)" : "→ Local Nano (≤1.2k)"}
                    </span>
                  </div>
                </div>

                {/* Image Preview Banner if diagram is loaded */}
                {selectedImage && (
                  <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E6E1D6] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-12 rounded-lg bg-white border border-[#DCD6C9] overflow-hidden flex items-center justify-center p-0.5">
                        <img
                          src={selectedImage}
                          alt="Input diagram"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1A1918]">
                          Multimodal Diagram Loaded
                        </div>
                        <div className="text-[11px] text-[#797670]">
                          Ready for Diagram Snip (ONLY_IN_CLOUD)
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedImage(null);
                        handleSelectTab("consensus");
                      }}
                      className="text-xs text-[#9E9A90] hover:text-[#A82B24] transition px-2 py-1 rounded"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons: 5 Distinct Router Functions */}
              <div className="pt-2 border-t border-[#F0EDE6] space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#797670] mb-2 flex items-center justify-between">
                  <span>Hybrid AI Router Actions:</span>
                  {isProcessing && (
                    <span className="text-[#C85A32] font-mono animate-pulse flex items-center gap-1 lowercase">
                      <RefreshCw className="w-3 h-3 animate-spin" /> {currentActionLabel}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {/* Action 1: Clip Concept */}
                  <button
                    onClick={handleActionClipConcept}
                    disabled={isProcessing || !inputText.trim()}
                    className="p-3 text-left rounded-xl border border-[#DCD6C9] bg-[#FAF9F6] hover:bg-white hover:border-[#C85A32] transition group disabled:opacity-50 disabled:cursor-not-allowed paper-shadow cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A1918] group-hover:text-[#C85A32]">
                        <Scissors className="w-3.5 h-3.5 text-[#C85A32]" />
                        <span>1. Clip Concept</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#797670] leading-snug">
                      Extracts core claim, role & domain entities.
                    </p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#EDF3EF] text-[#2E5E3E] border border-[#C2DACB]">
                        {isOverLength ? "Cloud (>1.2k)" : "PREFER_ON_DEVICE"}
                      </span>
                    </div>
                  </button>

                  {/* Action 2: Jargon X-Ray */}
                  <button
                    onClick={handleActionJargonXRay}
                    disabled={isProcessing || !inputText.trim()}
                    className="p-3 text-left rounded-xl border border-[#DCD6C9] bg-[#FAF9F6] hover:bg-white hover:border-[#C85A32] transition group disabled:opacity-50 disabled:cursor-not-allowed paper-shadow cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A1918] group-hover:text-[#C85A32]">
                        <Eye className="w-3.5 h-3.5 text-[#C85A32]" />
                        <span>2. Jargon X-Ray</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#797670] leading-snug">
                      3 plain-English bullet points without losing accuracy.
                    </p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#EDF3EF] text-[#2E5E3E] border border-[#C2DACB]">
                        PREFER_ON_DEVICE
                      </span>
                    </div>
                  </button>

                  {/* Action 3: 3-Box Micro-Flow */}
                  <button
                    onClick={handleActionMicroFlow}
                    disabled={isProcessing || !inputText.trim()}
                    className="p-3 text-left rounded-xl border border-[#DCD6C9] bg-[#FAF9F6] hover:bg-white hover:border-[#C85A32] transition group disabled:opacity-50 disabled:cursor-not-allowed paper-shadow cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A1918] group-hover:text-[#C85A32]">
                        <Layers className="w-3.5 h-3.5 text-[#C85A32]" />
                        <span>3. Micro-Flow</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#797670] leading-snug">
                      3-node causal or structural flow diagram.
                    </p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#EDF3EF] text-[#2E5E3E] border border-[#C2DACB]">
                        PREFER_ON_DEVICE
                      </span>
                    </div>
                  </button>

                  {/* Action 4: Local Privacy Redact */}
                  <button
                    onClick={handleActionPrivacyRedact}
                    disabled={isProcessing || !inputText.trim()}
                    className="p-3 text-left rounded-xl border border-[#DCD6C9] bg-[#FAF9F6] hover:bg-white hover:border-[#C85A32] transition group disabled:opacity-50 disabled:cursor-not-allowed paper-shadow cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A1918] group-hover:text-[#C85A32]">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#C85A32]" />
                        <span>4. Privacy Redact</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#797670] leading-snug">
                      Scrub names, emails, API keys before cloud egress.
                    </p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#EDF3EF] text-[#2E5E3E] border border-[#C2DACB]">
                        PREFER_ON_DEVICE
                      </span>
                    </div>
                  </button>

                  {/* Action 5: Cloud Weave Brief / Diagram Snip */}
                  <button
                    onClick={handleActionCloudSynthesisOrDiagram}
                    disabled={isProcessing}
                    className="p-3 text-left rounded-xl border border-[#E9CABE] bg-[#FAF0EC]/60 hover:bg-[#FAF0EC] hover:border-[#C85A32] transition group disabled:opacity-50 disabled:cursor-not-allowed paper-shadow sm:col-span-2 lg:col-span-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A1918] group-hover:text-[#C85A32]">
                        <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
                        <span>
                          {selectedImage
                            ? "5. Cloud Diagram Snip (Multimodal)"
                            : "5. Cloud Weave Brief (Multi-Source)"}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#F6EDE8] text-[#A54420] border border-[#E9CABE] font-bold">
                        ONLY_IN_CLOUD
                      </span>
                    </div>
                    <p className="text-[11px] text-[#797670] leading-snug">
                      {selectedImage
                        ? "Analyzes image visual diagram to extract structured Weave node & micro-flow."
                        : "Synthesizes consensus, contradictions, and blind spots across selected working nodes."}
                    </p>
                  </button>
                </div>
              </div>
            </div>

            {/* Structured Output Render Area */}
            {activeOutput && (
              <div className="bg-white border border-[#E6E1D6] rounded-2xl p-5 paper-shadow space-y-4">
                {/* Result Header & Live Provenance Badge */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#F0EDE6]">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#3FA264]" />
                    <h3 className="font-editorial-serif text-base font-bold text-[#1A1918]">
                      {activeOutput.actionLabel}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Live Inference Source Badge */}
                    <ProvenanceBadge source={activeOutput.source} size="md" />

                    {/* Latency badge */}
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#FAF9F6] border border-[#E6E1D6] text-[#797670] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#A09D96]" />
                      {activeOutput.latencyMs}ms
                    </span>

                    {/* Copy JSON */}
                    <button
                      onClick={handleCopyJson}
                      className="p-1.5 text-xs text-[#797670] hover:text-[#1A1918] rounded-lg border border-[#E6E1D6] hover:bg-[#FAF9F6] transition cursor-pointer"
                      title={copiedJson ? "Copied to clipboard!" : "Copy Raw Output JSON"}
                    >
                      {copiedJson ? (
                        <Check className="w-3.5 h-3.5 text-[#3FA264]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Rendered View depending on Action */}

                {/* 1. Concept Output */}
                {activeOutput.actionType === "concept" && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E6E1D6] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-[#EBF3FB] text-[#1E5692] border border-[#C2DBF2]">
                          {(activeOutput.data as ExtractConceptResult).role}
                        </span>
                        <button
                          onClick={handleSaveConceptToSession}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg bg-[#C85A32] text-white hover:bg-[#A54420] transition shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Working Nodes</span>
                        </button>
                      </div>

                      <blockquote className="font-editorial-serif text-base text-[#1A1918] leading-relaxed italic border-l-2 border-[#C85A32] pl-3">
                        "{(activeOutput.data as ExtractConceptResult).coreClaim}"
                      </blockquote>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#797670] mb-1.5">
                          Extracted Entities:
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(activeOutput.data as ExtractConceptResult).entities?.map((e, idx) => (
                            <span
                              key={idx}
                              className="text-xs font-mono px-2.5 py-1 rounded-lg bg-white border border-[#DCD6C9] text-[#1A1918]"
                            >
                              #{e}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Jargon X-Ray Output */}
                {activeOutput.actionType === "xray" && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#797670]">
                      Plain-English Intuition Breakdown:
                    </div>
                    <ul className="space-y-2.5">
                      {(activeOutput.data as JargonXRayResult).bullets?.map((b, i) => (
                        <li
                          key={i}
                          className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E6E1D6] flex items-start gap-3"
                        >
                          <span className="w-5 h-5 rounded-full bg-[#F6EDE8] text-[#C85A32] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-xs sm:text-sm font-editorial-serif text-[#1A1918] leading-relaxed">
                            {b}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3. Micro-Flow Output */}
                {activeOutput.actionType === "microflow" && (
                  <div>
                    <MicroFlowViewer
                      nodes={(activeOutput.data as MicroFlowResult).nodes}
                      edges={(activeOutput.data as MicroFlowResult).edges}
                    />
                  </div>
                )}

                {/* 4. Privacy Redact Output */}
                {activeOutput.actionType === "redact" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#797670]">
                      <span className="font-semibold text-[#2E5E3E]">
                        Sanitized Locally On-Device
                      </span>
                      <span className="font-mono bg-[#EDF3EF] text-[#2E5E3E] px-2 py-0.5 rounded-full border border-[#C2DACB]">
                        {(activeOutput.data as RedactResult).replacementsCount} scrubbed items
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E6E1D6] font-mono text-xs text-[#1A1918] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {(activeOutput.data as RedactResult).redactedText}
                    </div>

                    <div className="text-[11px] text-[#797670] italic">
                      Notice: Personal emails, API tokens, and private hostnames were sanitized on-device before any transmission.
                    </div>
                  </div>
                )}

                {/* 5. Weave Brief Output */}
                {activeOutput.actionType === "brief" && (
                  <div className="space-y-4">
                    {/* Brief Title */}
                    <div className="p-4 rounded-xl bg-[#FAF0EC]/50 border border-[#E9CABE]">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#C85A32]">
                        Executive Synthesis Title
                      </span>
                      <h4 className="font-editorial-serif text-lg font-bold text-[#1A1918] mt-1">
                        {(activeOutput.data as WeaveBriefResult).title}
                      </h4>
                    </div>

                    {/* Consensus Summary */}
                    <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E6E1D6] space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#4A4844]">
                        Cross-Source Consensus:
                      </div>
                      <p className="font-editorial-serif text-xs sm:text-sm text-[#1A1918] leading-relaxed">
                        {(activeOutput.data as WeaveBriefResult).consensusSummary}
                      </p>
                    </div>

                    {/* Contradictions & Tensions */}
                    <div className="p-4 rounded-xl bg-[#FFF8F7] border border-[#F5BEBA] space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#A82B24] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Identified Contradictions & Tensions:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-xs text-[#1A1918]">
                        {(activeOutput.data as WeaveBriefResult).contradictions?.map((c, i) => (
                          <li key={i} className="font-editorial-serif">
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Blind Spot Questions */}
                    <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#DCD6C9] space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#797670]">
                        Critical Blind-Spot Questions:
                      </div>
                      <ol className="list-decimal list-inside space-y-1.5 text-xs text-[#1A1918]">
                        {(activeOutput.data as WeaveBriefResult).blindSpotQuestions?.map((q, i) => (
                          <li key={i} className="font-editorial-serif font-medium">
                            {q}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}

                {/* 6. Diagram Snip Output */}
                {activeOutput.actionType === "diagram" && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E6E1D6] space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#EBF3FB] text-[#1E5692] border border-[#C2DBF2]">
                          {(activeOutput.data as any).role}
                        </span>
                        <span className="text-xs text-[#797670]">Extracted Claim:</span>
                      </div>
                      <p className="font-editorial-serif text-sm font-medium text-[#1A1918]">
                        "{(activeOutput.data as any).coreClaim}"
                      </p>

                      <div className="flex items-center gap-1.5 pt-2 flex-wrap">
                        {(activeOutput.data as any).entities?.map((e: string, i: number) => (
                          <span
                            key={i}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-[#DCD6C9]"
                          >
                            #{e}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Extracted Micro-Flow from Diagram */}
                    {(activeOutput.data as any).microFlow && (
                      <MicroFlowViewer
                        nodes={(activeOutput.data as any).microFlow.nodes}
                        edges={(activeOutput.data as any).microFlow.edges}
                        title="Extracted Architecture Micro-Flow"
                      />
                    )}
                  </div>
                )}

                {/* Collapsible Raw JSON Inspector */}
                <details className="pt-2 border-t border-[#F0EDE6] text-xs">
                  <summary className="cursor-pointer text-[11px] font-mono text-[#797670] hover:text-[#1A1918] flex items-center gap-1 py-1">
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Inspect Raw Model Response Payload</span>
                  </summary>
                  <pre className="mt-2 p-3 rounded-xl bg-[#1A1918] text-[#FAF9F6] font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed">
                    {activeOutput.rawJson}
                  </pre>
                </details>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Working Knowledge Nodes (5 cols) */}
          <div className="lg:col-span-5">
            <WorkingNodesPanel
              nodes={savedNodes}
              selectedNodeIds={selectedNodeIds}
              onToggleSelect={(id) => {
                setSelectedNodeIds((prev) =>
                  prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                );
              }}
              onSelectAll={() => setSelectedNodeIds(savedNodes.map((n) => n.id))}
              onClearSelection={() => setSelectedNodeIds([])}
              onDeleteNode={(id) => {
                setSavedNodes((prev) => prev.filter((n) => n.id !== id));
                setSelectedNodeIds((prev) => prev.filter((i) => i !== id));
              }}
              onAddSampleNodes={() => {
                setSavedNodes(INITIAL_PRESET_NODES);
                setSelectedNodeIds(INITIAL_PRESET_NODES.map((n) => n.id));
              }}
              onSynthesizeBrief={handleSynthesizeBrief}
              isSynthesizing={isSynthesizingBrief}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-[#E6E1D6] bg-white py-4 text-center text-xs text-[#797670]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>Weave</strong> • Spatial Knowledge Architecture with Firebase AI Logic & Chrome Gemini Nano
          </div>
          <div className="font-mono text-[11px] text-[#A09D96]">
            #BuildHybridAI 2026 • React + Vite + TypeScript + Tailwind CSS
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigUpdated={() => {
          checkOnDeviceStatus().then(setOnDeviceStatus);
        }}
      />
    </div>
  );
}

export default App;
