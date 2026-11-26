import React, { useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps, useViewport } from "@xyflow/react";
import {
  ArrowUpRight,
  Check,
  CheckSquare,
  Copy,
  Edit3,
  FileText,
  GitBranch,
  Heading2,
  List,
  Loader2,
  Maximize2,
  Minus,
  Quote,
  Scale,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import type { JargonGlossaryItem, MicroFlowEdge, MicroFlowNode } from "../types/weave";

export type CardTintKey = "white" | "sand" | "sage" | "sky" | "rose";

export const CARD_TINTS: Record<
  CardTintKey,
  { label: string; bg: string; border: string; swatch: string }
> = {
  white: {
    label: "Paper White",
    bg: "bg-white",
    border: "border-[#E5E7EB]",
    swatch: "bg-white border-[#D1D5DB]",
  },
  sand: {
    label: "Warm Sand",
    bg: "bg-[#FDF8EE]",
    border: "border-[#EFE3C8]",
    swatch: "bg-[#F6E8C8] border-[#DFCCA3]",
  },
  sage: {
    label: "Sage Mist",
    bg: "bg-[#F3F8F4]",
    border: "border-[#D7E8DC]",
    swatch: "bg-[#D5EAD9] border-[#B4D4BC]",
  },
  sky: {
    label: "Sky Tint",
    bg: "bg-[#F2F7FD]",
    border: "border-[#D5E3F6]",
    swatch: "bg-[#D3E4FA] border-[#B1CCEE]",
  },
  rose: {
    label: "Rose Blush",
    bg: "bg-[#FDF4F5]",
    border: "border-[#F3D8DC]",
    swatch: "bg-[#F7D7DC] border-[#E4B6BD]",
  },
};

const MicroFlowDiagram: React.FC<{ nodes: MicroFlowNode[]; edges: MicroFlowEdge[] }> = ({
  nodes,
  edges,
}) => {
  if (!nodes || nodes.length === 0) return null;
  return (
    <div className="mt-2.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-2">
      <div className="flex flex-wrap items-center justify-between gap-1">
        {nodes.map((n, idx) => {
          const outgoing = edges.find((e) => e.from === n.id);
          return (
            <React.Fragment key={n.id}>
              <div className="min-w-16 flex-1 rounded border border-[#D1D5DB] bg-white px-1.5 py-1 text-center text-[10px] font-medium leading-tight text-[#111827]">
                {n.label}
              </div>
              {idx < nodes.length - 1 && (
                <div className="flex flex-col items-center px-0.5 text-[8px] text-[#6B7280]">
                  <span>{outgoing?.relation || "→"}</span>
                  <span className="leading-none">→</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export const CanvasCard: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { zoom } = useViewport();
  const isCondensed = zoom < 0.5;

  const d = data as Record<string, unknown>;
  const nodeType = (d.nodeType as string) || "note";
  const tintKey =
    ((d.tint as CardTintKey) || "white") in CARD_TINTS
      ? ((d.tint as CardTintKey) || "white")
      : "white";
  const tint = CARD_TINTS[tintKey];

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(
    (d.title as string) || (d.label as string) || (d.sourceTitle as string) || ""
  );
  const [editBody, setEditBody] = useState(
    (d.coreClaim as string) || (d.content as string) || ""
  );
  const [slashFilter, setSlashFilter] = useState<string | null>(null);
  const [aiTriggerOpen, setAiTriggerOpen] = useState(false);

  const [showXRay, setShowXRay] = useState(false);
  const [showFlow, setShowFlow] = useState(false);
  const [showRawQuote, setShowRawQuote] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"xray" | "flow" | "inlineAI" | null>(null);

  const onUpdate = d.onUpdateNode as ((nodeId: string, patch: Record<string, unknown>) => void) | undefined;
  const onDelete = d.onDeleteNode as ((nodeId: string) => void) | undefined;
  const onDuplicate = d.onDuplicateNode as ((nodeId: string) => void) | undefined;
  const onRunXRay = d.onRunXRay as ((nodeId: string) => Promise<void>) | undefined;
  const onRunFlow = d.onRunFlow as ((nodeId: string) => Promise<void>) | undefined;
  const onRunInlineAI = d.onRunInlineAI as
    | ((text: string, action: "sharpen" | "counter" | "bullets" | "continue") => Promise<string>)
    | undefined;
  const onOpenNoteInEditor = d.onOpenNoteInEditor as ((nodeId: string) => void) | undefined;
  const onOpenDocument = d.onOpenDocument as ((nodeId: string) => void) | undefined;

  const handleSaveEdit = () => {
    setIsEditing(false);
    setSlashFilter(null);
    setAiTriggerOpen(false);
    if (!onUpdate) return;
    if (nodeType === "frame") {
      onUpdate(id, { label: editTitle.trim() || "Topic Frame" });
    } else if (nodeType === "note") {
      onUpdate(id, { title: editTitle.trim() || "Note", content: editBody });
    } else {
      onUpdate(id, {
        sourceTitle: editTitle.trim() || "Clip",
        coreClaim: editBody,
      });
    }
  };

  // Detect `//` Inline AI Cursor OR `/` Block Command while typing
  const handleBodyChange = (val: string) => {
    setEditBody(val);
    if (val.endsWith("//")) {
      setAiTriggerOpen(true);
      setSlashFilter(null);
      return;
    }
    setAiTriggerOpen(false);

    const match = val.match(/(?:^|\n)\/([a-zA-Z0-9]*)$/);
    if (match) {
      setSlashFilter(match[1].toLowerCase());
    } else {
      setSlashFilter(null);
    }
  };

  const executeInlineCursorAI = async (
    action: "sharpen" | "counter" | "bullets" | "continue"
  ) => {
    const cleanText = editBody.replace(/\/\/$/, "").trim();
    setAiTriggerOpen(false);
    if (!cleanText || !onRunInlineAI) return;
    setLoadingAction("inlineAI");
    try {
      const output = await onRunInlineAI(cleanText, action);
      if (action === "sharpen" || action === "bullets") {
        setEditBody(output);
      } else {
        setEditBody(`${cleanText}\n\n${output}`);
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const applySlashCommand = (cmd: string) => {
    const cleaned = editBody.replace(/(?:^|\n)\/[a-zA-Z0-9]*$/, (m) =>
      m.startsWith("\n") ? "\n" : ""
    );
    setSlashFilter(null);

    if (cmd === "heading") setEditBody(cleaned + "### Heading\n");
    else if (cmd === "bullet") setEditBody(cleaned + "• ");
    else if (cmd === "todo") setEditBody(cleaned + "☐ ");
    else if (cmd === "quote") setEditBody(cleaned + "> ");
    else if (cmd === "divider") setEditBody(cleaned + "\n──────────\n");
  };

  // Spatial Frame Container
  if (nodeType === "frame") {
    const label = (d.label as string) || "Topic Frame";
    return (
      <div
        className={`relative h-full w-full rounded-2xl border transition-colors ${
          selected
            ? "border-[#1f2937] bg-[#F3F4F6]/60"
            : "border-[#D1D5DB] bg-white/50"
        }`}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={280}
          minHeight={180}
          lineClassName="border-[#1f2937]"
          handleClassName="h-2.5 w-2.5 rounded-sm border border-[#1f2937] bg-white"
        />
        <div className="absolute -top-6 left-0 flex items-center gap-2">
          {isEditing ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              className="rounded border border-[#1f2937] bg-white px-1.5 py-0.5 text-xs font-semibold text-[#111827] focus:outline-none"
            />
          ) : (
            <span
              onDoubleClick={() => {
                setEditTitle(label);
                setIsEditing(true);
              }}
              className="cursor-text text-xs font-semibold tracking-tight text-[#374151]"
            >
              {label}
            </span>
          )}
          {selected && onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="rounded p-0.5 text-[#9CA3AF] hover:text-[#111827]"
              title="Delete frame"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const externalTitle =
    (d.title as string) ||
    (d.sourceTitle as string) ||
    (nodeType === "diagram" ? "Diagram" : nodeType === "document" ? "Synthesized Note" : "Clip");

  const headline =
    (d.title as string) ||
    (d.coreClaim as string) ||
    (d.content as string) ||
    "Untitled";

  if (isCondensed) {
    return (
      <div
        className={`w-56 rounded-xl border ${tint.bg} px-3 py-2 shadow-xs ${
          selected ? "border-[#1f2937] ring-1 ring-[#1f2937]" : tint.border
        }`}
      >
        <Handle id="left" type="source" position={Position.Left} className="h-2! w-2! bg-[#1f2937]!" />
        <p className="truncate font-serif text-xs font-medium text-[#111827]">{headline}</p>
        <Handle id="right" type="source" position={Position.Right} className="h-2! w-2! bg-[#1f2937]!" />
      </div>
    );
  }

  const entities = Array.isArray(d.entities) ? (d.entities as string[]) : [];
  const xrayBullets = Array.isArray(d.xrayBullets) ? (d.xrayBullets as string[]) : undefined;
  const xrayGlossary = Array.isArray(d.xrayGlossary)
    ? (d.xrayGlossary as JargonGlossaryItem[])
    : undefined;
  const microFlow = d.microFlow as
    | { nodes: MicroFlowNode[]; edges: MicroFlowEdge[] }
    | undefined;

  const slashItems = [
    { id: "heading", label: "Heading", icon: Heading2 },
    { id: "bullet", label: "Bullet list", icon: List },
    { id: "todo", label: "Checklist", icon: CheckSquare },
    { id: "quote", label: "Quote block", icon: Quote },
    { id: "divider", label: "Divider", icon: Minus },
  ].filter(
    (item) =>
      !slashFilter ||
      item.id.includes(slashFilter) ||
      item.label.toLowerCase().includes(slashFilter)
  );

  return (
    <div className="group relative h-full w-72 select-text">
      <NodeResizer
        isVisible={selected}
        minWidth={288}
        minHeight={132}
        lineClassName="border-[#1f2937]"
        handleClassName="h-2.5 w-2.5 rounded-sm border border-[#1f2937] bg-white"
      />

      {/* Hover & Selection Floating Action Bar */}
      {!isEditing && (
        <div
          className={`nodrag absolute -top-9 right-0 z-20 flex items-center gap-0.5 rounded-full border border-[#E5E7EB] bg-white px-1.5 py-1 shadow-md transition-opacity ${
            selected
              ? "opacity-100"
              : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
          }`}
        >
          <button
            disabled={loadingAction === "xray" || loadingAction === "inlineAI"}
            onClick={async () => {
              if (nodeType === "concept") {
                if (xrayBullets) {
                  setShowXRay(!showXRay);
                  return;
                }
                if (!onRunXRay) return;
                setLoadingAction("xray");
                await onRunXRay(id);
                setLoadingAction(null);
                setShowXRay(true);
              } else if (nodeType === "note" && onRunInlineAI) {
                const body = (d.content as string) || "";
                if (!body.trim()) return;
                setLoadingAction("inlineAI");
                const expanded = await onRunInlineAI(body, "continue");
                onUpdate?.(id, { content: `${body.trim()}\n\n${expanded}` });
                setLoadingAction(null);
              }
            }}
            title={nodeType === "concept" ? "Ask AI: X-Ray Breakdown" : "Ask AI: Continue Thought"}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
              showXRay
                ? "bg-[#1f2937] text-white"
                : "text-[#374151] hover:bg-[#F3F4F6]"
            }`}
          >
            {loadingAction === "xray" || loadingAction === "inlineAI" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Ask AI
          </button>

          {nodeType === "concept" && (
            <>
              <button
                disabled={loadingAction === "flow"}
                onClick={async () => {
                  if (microFlow) {
                    setShowFlow(!showFlow);
                    return;
                  }
                  if (!onRunFlow) return;
                  setLoadingAction("flow");
                  await onRunFlow(id);
                  setLoadingAction(null);
                  setShowFlow(true);
                }}
                title="Causal Flow"
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  showFlow
                    ? "bg-[#1f2937] text-white"
                    : "text-[#374151] hover:bg-[#F3F4F6]"
                }`}
              >
                {loadingAction === "flow" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <GitBranch className="h-3 w-3" />
                )}
                Flow
              </button>

              <button
                onClick={() => setShowRawQuote(!showRawQuote)}
                title="Original Quote"
                className={`rounded-full p-1 transition-colors ${
                  showRawQuote
                    ? "bg-[#1f2937] text-white"
                    : "text-[#4B5563] hover:bg-[#F3F4F6]"
                }`}
              >
                <Quote className="h-3 w-3" />
              </button>
            </>
          )}

          {(nodeType === "note" || nodeType === "concept") && onOpenNoteInEditor && (
            <button
              onClick={() => onOpenNoteInEditor(id)}
              title="Open in Full Editor"
              className="rounded-full p-1 text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          )}

          {/* Pastel Tint Swatches */}
          <div className="mx-0.5 flex items-center gap-0.5 border-x border-[#ECEEF2] px-1">
            {(Object.keys(CARD_TINTS) as CardTintKey[]).map((key) => (
              <button
                key={key}
                onClick={() => onUpdate?.(id, { tint: key })}
                title={CARD_TINTS[key].label}
                className={`h-2.5 w-2.5 rounded-full border transition-transform hover:scale-125 ${
                  CARD_TINTS[key].swatch
                } ${tintKey === key ? "ring-1 ring-[#1f2937]" : ""}`}
              />
            ))}
          </div>

          {(nodeType === "note" || nodeType === "concept") && (
            <button
              onClick={() => {
                setEditTitle((d.title as string) || (d.sourceTitle as string) || "");
                setEditBody((d.coreClaim as string) || (d.content as string) || "");
                setIsEditing(true);
              }}
              title="Edit inline"
              className="rounded-full p-1 text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]"
            >
              <Edit3 className="h-3 w-3" />
            </button>
          )}

          {onDuplicate && (
            <button
              onClick={() => onDuplicate(id)}
              title="Duplicate"
              className="rounded-full p-1 text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}

          {onDelete && (
            <button
              onClick={() => onDelete(id)}
              title="Delete"
              className="rounded-full p-1 text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Quiet External Header Above Top-Left Border */}
      <div className="mb-1 flex items-center justify-between px-0.5">
        <span className="truncate text-[10px] font-medium text-[#6B7280]">
          {externalTitle}
        </span>
        {typeof d.sourceUrl === "string" && d.sourceUrl && (
          <a
            href={d.sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#374151] hover:underline"
          >
            Source <ArrowUpRight className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      {/* Standard-Height Craft Note / Clip Card */}
      <div
        className={`flex min-h-36 h-full flex-col justify-between rounded-xl border p-4 transition-all ${tint.bg} ${
          selected
            ? "border-[#1f2937] shadow-[0_6px_18px_rgba(17,24,39,0.08)]"
            : `${tint.border} shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-[#9CA3AF]`
        }`}
      >
        {/* 4-Way Connection Handles */}
        <Handle
          id="left"
          type="source"
          position={Position.Left}
          className="h-2.5! w-2.5! border-2! border-white! bg-[#1f2937]!"
        />
        <Handle
          id="right"
          type="source"
          position={Position.Right}
          className="h-2.5! w-2.5! border-2! border-white! bg-[#1f2937]!"
        />
        <Handle
          id="top"
          type="source"
          position={Position.Top}
          className="h-2.5! w-2.5! border-2! border-white! bg-[#1f2937]!"
        />
        <Handle
          id="bottom"
          type="source"
          position={Position.Bottom}
          className="h-2.5! w-2.5! border-2! border-white! bg-[#1f2937]!"
        />

        {/* Manual Note Card with `//` Inline AI Cursor & `/` Block Menu */}
        {nodeType === "note" && (
          <div className="relative flex-1">
            {isEditing ? (
              <div className="nodrag space-y-2">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Note heading..."
                  className="w-full border-b border-[#E5E7EB] bg-transparent pb-1 text-xs font-semibold text-[#111827] focus:border-[#1f2937] focus:outline-none"
                />
                <textarea
                  autoFocus
                  rows={4}
                  value={editBody}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  placeholder="Write here... Type // for AI or / for blocks"
                  className="w-full resize-none rounded-lg border border-[#E5E7EB] bg-white/85 p-2 text-xs leading-relaxed text-[#111827] focus:border-[#1f2937] focus:outline-none"
                />

                {/* Inline AI Cursor Bar (`//`) */}
                {aiTriggerOpen && (
                  <div className="rounded-xl border border-[#1f2937] bg-white p-1.5 shadow-lg">
                    <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#374151]">
                      Inline AI Cursor
                    </div>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        executeInlineCursorAI("sharpen");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs text-[#111827] hover:bg-[#F3F4F6]"
                    >
                      <Wand2 className="h-3.5 w-3.5 text-[#1f2937]" />
                      Sharpen claim
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        executeInlineCursorAI("continue");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs text-[#111827] hover:bg-[#F3F4F6]"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#1f2937]" />
                      Continue thought
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        executeInlineCursorAI("counter");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs text-[#111827] hover:bg-[#F3F4F6]"
                    >
                      <Scale className="h-3.5 w-3.5 text-[#1f2937]" />
                      Add counter-argument
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        executeInlineCursorAI("bullets");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs text-[#111827] hover:bg-[#F3F4F6]"
                    >
                      <List className="h-3.5 w-3.5 text-[#1f2937]" />
                      Structure as bullets
                    </button>
                  </div>
                )}

                {/* Notion-Style `/` Slash Block Menu */}
                {slashFilter !== null && slashItems.length > 0 && (
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-lg">
                    <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                      Insert Block
                    </div>
                    {slashItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applySlashCommand(item.id);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs text-[#111827] hover:bg-[#F3F4F6]"
                        >
                          <Icon className="h-3.5 w-3.5 text-[#4B5563]" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#9CA3AF]">
                    {loadingAction === "inlineAI" ? "Thinking locally..." : "// AI · / Blocks"}
                  </span>
                  <button
                    onClick={handleSaveEdit}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#1f2937] px-2.5 py-1 text-[11px] font-medium text-white"
                  >
                    <Check className="h-3 w-3" /> Done
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDoubleClick={() => {
                  setEditTitle((d.title as string) || "");
                  setEditBody((d.content as string) || "");
                  setIsEditing(true);
                }}
                className="h-full cursor-text"
              >
                {typeof d.title === "string" && d.title && (
                  <h4 className="mb-1.5 text-xs font-semibold text-[#111827]">
                    {d.title}
                  </h4>
                )}
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#374151]">
                  {(d.content as string) || "Double-click to write, or type // for Inline AI..."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Diagram Card */}
        {nodeType === "diagram" && (
          <div className="space-y-2">
            {typeof d.imageBase64 === "string" && (
              <img
                src={d.imageBase64}
                alt="Diagram"
                className="max-h-36 w-full rounded-lg border border-[#E5E7EB] bg-white object-contain"
              />
            )}
            <p className="font-serif text-xs font-medium leading-snug text-[#111827]">
              {d.coreClaim as string}
            </p>
            {microFlow && (
              <MicroFlowDiagram nodes={microFlow.nodes} edges={microFlow.edges} />
            )}
          </div>
        )}

        {/* Synthesized Full Document Card */}
        {nodeType === "document" && (
          <div className="space-y-2.5">
            <h4 className="font-serif text-xs font-semibold leading-snug text-[#111827]">
              {(d.title as string) || "Synthesized Research Note"}
            </h4>
            <p className="line-clamp-3 text-[11px] leading-relaxed text-[#4B5563]">
              {((d.markdownContent as string) || "")
                .replace(/^#+\s*/gm, "")
                .slice(0, 150)}
              ...
            </p>
            {onOpenDocument && (
              <button
                onClick={() => onOpenDocument(id)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1f2937] px-2.5 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
              >
                <FileText className="h-3 w-3" />
                Open in Full Editor
              </button>
            )}
          </div>
        )}

        {/* Clip / Concept Card */}
        {nodeType === "concept" && (
          <div className="flex-1">
            {isEditing ? (
              <div className="nodrag space-y-2">
                <textarea
                  autoFocus
                  rows={3}
                  value={editBody}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  className="w-full resize-none rounded-lg border border-[#1f2937] bg-white p-2 font-serif text-xs leading-relaxed text-[#111827] focus:outline-none"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveEdit}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#1f2937] px-2.5 py-1 text-[11px] font-medium text-white"
                  >
                    <Check className="h-3 w-3" /> Save
                  </button>
                </div>
              </div>
            ) : (
              <p
                onDoubleClick={() => {
                  setEditTitle((d.sourceTitle as string) || "");
                  setEditBody((d.coreClaim as string) || "");
                  setIsEditing(true);
                }}
                className="cursor-text font-serif text-xs font-medium leading-relaxed text-[#111827]"
              >
                {d.coreClaim as string}
              </p>
            )}

            {showXRay && xrayBullets && (
              <div className="mt-2.5 rounded-lg border border-[#E5E7EB] bg-white/85 p-2 text-[11px] text-[#374151]">
                <ul className="list-disc space-y-1 pl-3.5 leading-snug">
                  {xrayBullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
                {xrayGlossary && xrayGlossary.length > 0 && (
                  <div className="mt-1.5 border-t border-[#E5E7EB] pt-1.5 space-y-1">
                    {xrayGlossary.map((g, i) => (
                      <p key={i} className="text-[10px] leading-snug text-[#4B5563]">
                        <strong className="font-semibold text-[#111827]">{g.term}:</strong>{" "}
                        {g.definition}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showFlow && microFlow && (
              <MicroFlowDiagram nodes={microFlow.nodes} edges={microFlow.edges} />
            )}

            {showRawQuote && typeof d.rawText === "string" && (
              <blockquote className="mt-2.5 border-l-2 border-[#1f2937] pl-2 text-[11px] italic leading-relaxed text-[#4B5563]">
                "{d.rawText}"
              </blockquote>
            )}
          </div>
        )}

        {/* Compact Topic Tags */}
        {entities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {entities.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] font-medium text-[#374151]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};