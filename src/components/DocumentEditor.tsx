import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import type { WeaveNode } from "../types/weave";

interface DocumentEditorProps {
  title: string;
  markdownContent: string;
  contributingNodes: WeaveNode[];
  onChangeTitle: (title: string) => void;
  onChangeMarkdown: (markdown: string) => void;
  onBackToCanvas: () => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  title,
  markdownContent,
  contributingNodes,
  onChangeTitle,
  onChangeMarkdown,
  onBackToCanvas,
}) => {
  const [copied, setCopied] = useState(false);
  const [showSourcesRail, setShowSourcesRail] = useState(true);

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadMarkdown = () => {
    const safeSlug = (title || "weave-note")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeSlug || "weave-document"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F6F7F9] text-[#111827]">
      {/* Minimal Top Bar */}
      <header className="flex items-center justify-between border-b border-[#E2E5EC] bg-white px-6 py-3">
        <button
          onClick={onBackToCanvas}
          className="inline-flex items-center gap-2 rounded-md border border-[#DCD7CC] bg-white px-3 py-1.5 text-xs font-medium text-[#141413] transition-colors hover:border-[#141413]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Canvas
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#DCD7CC] bg-white px-3 py-1.5 text-xs font-medium text-[#141413] transition-colors hover:border-[#141413]"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Markdown"}
          </button>

          <button
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#141413] bg-[#141413] px-3 py-1.5 text-xs font-medium text-[#FAF8F3] transition-opacity hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" />
            Export .md
          </button>

          <button
            onClick={() => setShowSourcesRail(!showSourcesRail)}
            title="Toggle Source Reference Rail"
            className="ml-1 rounded-md border border-[#DCD7CC] bg-white p-1.5 text-[#5C5A55] hover:border-[#141413] hover:text-[#141413]"
          >
            {showSourcesRail ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Writing Space + Docked Source Reference Rail */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-8 py-10">
          <div className="mx-auto max-w-3xl">
            <input
              type="text"
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              placeholder="Document Title..."
              className="mb-6 w-full border-none bg-transparent font-serif text-3xl font-semibold tracking-tight text-[#141413] placeholder-[#A8A297] focus:outline-none"
            />
            <textarea
              value={markdownContent}
              onChange={(e) => onChangeMarkdown(e.target.value)}
              placeholder="Write or refine your synthesized research document in Markdown..."
              className="min-h-[70vh] w-full resize-none border-none bg-transparent font-sans text-sm leading-7 text-[#1F1E1C] placeholder-[#A8A297] focus:outline-none"
            />
          </div>
        </main>

        {showSourcesRail && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-[#E2E5EC] bg-white p-4">
            <h3 className="mb-3 font-serif text-xs font-semibold uppercase tracking-wider text-[#5C5A55]">
              Source Reference Cards ({contributingNodes.length})
            </h3>
            {contributingNodes.length === 0 ? (
              <p className="text-xs text-[#7A766E]">
                Standalone document. Select a Spatial Frame or group of cards on the canvas to synthesize from sources.
              </p>
            ) : (
              <div className="space-y-2.5">
                {contributingNodes.map((src) => (
                  <div
                    key={src.id}
                    className="rounded-lg border border-[#DCD7CC] bg-white p-3 text-xs"
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <span className="truncate font-medium text-[#5C5A55]">
                        {src.sourceTitle || "Canvas Note"}
                      </span>
                      {src.sourceUrl && (
                        <a
                          href={src.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10px] text-[#141413] underline"
                        >
                          Link <ArrowUpRight className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                    <p className="font-serif font-medium leading-snug text-[#141413]">
                      {src.coreClaim}
                    </p>
                    {src.rawText && src.rawText !== src.coreClaim && (
                      <p className="mt-1.5 line-clamp-3 border-l border-[#DCD7CC] pl-2 text-[11px] italic text-[#5C5A55]">
                        "{src.rawText}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};