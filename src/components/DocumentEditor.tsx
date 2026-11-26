import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  List,
  Scale,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { WeaveNode } from "../types/weave";

interface DocumentEditorProps {
  title: string;
  markdownContent: string;
  contributingNodes: WeaveNode[];
  onChangeTitle: (newTitle: string) => void;
  onChangeMarkdown: (newMarkdown: string) => void;
  onRunInlineAI?: (
    text: string,
    action: "sharpen" | "counter" | "bullets" | "continue"
  ) => Promise<string>;
  onBackToCanvas: () => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  title,
  markdownContent,
  contributingNodes,
  onChangeTitle,
  onChangeMarkdown,
  onRunInlineAI,
  onBackToCanvas,
}) => {
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  const [aiBarOpen, setAiBarOpen] = useState(false);
  const [isGeneratingInline, setIsGeneratingInline] = useState(false);

  const handleExportMarkdown = () => {
    const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "weave-note"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleEditorChange = (val: string) => {
    onChangeMarkdown(val);
    if (val.endsWith("//")) {
      setAiBarOpen(true);
    } else {
      setAiBarOpen(false);
    }
  };

  const handleInlineAction = async (
    action: "sharpen" | "counter" | "bullets" | "continue"
  ) => {
    const clean = markdownContent.replace(/\/\/$/, "").trim();
    setAiBarOpen(false);
    if (!clean || !onRunInlineAI) return;
    setIsGeneratingInline(true);
    try {
      // Send the last paragraph as active cursor context
      const paragraphs = clean.split(/\n\n+/);
      const targetPara = paragraphs[paragraphs.length - 1] || clean;
      const result = await onRunInlineAI(targetPara, action);
      onChangeMarkdown(`${clean}\n\n${result}`);
    } finally {
      setIsGeneratingInline(false);
    }
  };

  // Extract `[1]`, `[2]` citation indices present in the draft for click-to-trace
  const citationNumbers = useMemo(() => {
    const matches = markdownContent.match(/\[(\d+)\]/g) || [];
    const unique = new Set<number>();
    for (const m of matches) {
      const n = Number(m.replace(/\D/g, ""));
      if (n >= 1 && n <= contributingNodes.length) unique.add(n);
    }
    return Array.from(unique).sort((a, b) => a - b);
  }, [markdownContent, contributingNodes.length]);

  const jumpToCitation = (indexOneBased: number) => {
    const node = contributingNodes[indexOneBased - 1];
    if (!node) return;
    setHighlightedSourceId(node.id);
    const el = document.getElementById(`weave-source-${node.id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F9FAFB] text-[#111827]">
      {/* Top Editorial Header Bar */}
      <header className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-6 py-3">
        <button
          onClick={onBackToCanvas}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Spatial Canvas
        </button>

        <div className="flex items-center gap-2">
          {citationNumbers.length > 0 && (
            <div className="hidden items-center gap-1 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1 text-[11px] text-[#4B5563] sm:flex">
              <span>Trace citations:</span>
              {citationNumbers.map((num) => (
                <button
                  key={num}
                  onClick={() => jumpToCitation(num)}
                  className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#111827] shadow-2xs hover:bg-[#1f2937] hover:text-white"
                >
                  [{num}]
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f2937] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" />
            Export .md
          </button>
        </div>
      </header>

      {/* Main Two-Column Space */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center-Left Editorial Canvas */}
        <main className="relative flex-1 overflow-y-auto px-8 py-10 md:px-16 lg:px-24">
          <div className="mx-auto max-w-2xl">
            <input
              type="text"
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              placeholder="Document Title..."
              className="w-full border-none bg-transparent font-serif text-3xl font-semibold tracking-tight text-[#111827] placeholder-[#9CA3AF] focus:outline-none"
            />

            <div className="mt-2 flex items-center justify-between text-[11px] text-[#6B7280]">
              <span>
                {isGeneratingInline
                  ? "Inline AI writing locally..."
                  : "Tip: Type // at the end of any paragraph to summon Inline AI"}
              </span>
            </div>

            <div className="my-5 h-px w-full bg-[#E5E7EB]" />

            {/* Inline AI Cursor Bar (`//`) */}
            {aiBarOpen && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-[#1f2937] bg-white p-2 shadow-md">
                <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#4B5563]">
                  Inline AI:
                </span>
                <button
                  onClick={() => handleInlineAction("continue")}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#111827] hover:bg-[#1f2937] hover:text-white"
                >
                  <Sparkles className="h-3 w-3" /> Continue
                </button>
                <button
                  onClick={() => handleInlineAction("sharpen")}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#111827] hover:bg-[#1f2937] hover:text-white"
                >
                  <Wand2 className="h-3 w-3" /> Sharpen
                </button>
                <button
                  onClick={() => handleInlineAction("counter")}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#111827] hover:bg-[#1f2937] hover:text-white"
                >
                  <Scale className="h-3 w-3" /> Counter-Argument
                </button>
                <button
                  onClick={() => handleInlineAction("bullets")}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#111827] hover:bg-[#1f2937] hover:text-white"
                >
                  <List className="h-3 w-3" /> Summarize Bullets
                </button>
              </div>
            )}

            <textarea
              value={markdownContent}
              onChange={(e) => handleEditorChange(e.target.value)}
              placeholder="Write your synthesized document in Markdown... Type // for Inline AI"
              className="min-h-[65vh] w-full resize-none border-none bg-transparent font-sans text-[15px] leading-[1.8] text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none"
            />
          </div>
        </main>

        {/* Right-Hand Docked Source Reference Rail (Click-to-Trace Target) */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-[#E5E7EB] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wider text-[#374151] uppercase">
              Source Cards ({contributingNodes.length})
            </h3>
          </div>

          {contributingNodes.length === 0 ? (
            <p className="text-xs leading-relaxed text-[#6B7280]">
              No linked source cards yet. Select a Spatial Frame or multiple cards on the canvas and click{" "}
              <strong>Synthesize Full Note</strong> to populate cited sources here.
            </p>
          ) : (
            <div className="space-y-3">
              {contributingNodes.map((src, idx) => {
                const isHighlighted = highlightedSourceId === src.id;
                return (
                  <div
                    key={src.id}
                    id={`weave-source-${src.id}`}
                    onClick={() => setHighlightedSourceId(src.id)}
                    className={`cursor-pointer rounded-xl border p-3 text-xs transition-all ${
                      isHighlighted
                        ? "border-[#1f2937] bg-[#F3F4F6] ring-1 ring-[#1f2937]"
                        : "border-[#E5E7EB] bg-[#F9FAFB] hover:border-[#9CA3AF]"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-semibold text-[#111827]">
                        [{idx + 1}] {src.sourceTitle || src.role}
                      </span>
                      {src.sourceUrl && (
                        <a
                          href={src.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 text-[10px] text-[#374151] hover:underline"
                        >
                          Link <ArrowUpRight className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>

                    <p className="font-serif text-[12px] font-medium leading-snug text-[#111827]">
                      {src.coreClaim}
                    </p>

                    {src.rawText && src.rawText !== src.coreClaim && (
                      <p className="mt-2 border-l-2 border-[#D1D5DB] pl-2 text-[11px] italic leading-relaxed text-[#4B5563]">
                        "{src.rawText.slice(0, 180)}
                        {src.rawText.length > 180 ? "..." : ""}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};