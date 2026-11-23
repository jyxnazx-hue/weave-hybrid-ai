import React, { useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps, useViewport } from "@xyflow/react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Edit3,
  FileText,
  GitBranch,
  Loader2,
  Quote,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { JargonGlossaryItem, MicroFlowEdge, MicroFlowNode } from "../types/weave";

const MicroFlowDiagram: React.FC<{ nodes: MicroFlowNode[]; edges: MicroFlowEdge[] }> = ({
  nodes,
  edges,
}) => {
  if (!nodes || nodes.length === 0) return null;
  return (
    <div className="mt-2 rounded-lg border border-[#E5E7EB] bg-[#F6F7F9] p-2">
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
  const isCondensed = zoom < 0.52;

  const d = data as Record<string, unknown>;
  const nodeType = (d.nodeType as string) || "note";

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(
    (d.title as string) || (d.label as string) || (d.sourceTitle as string) || ""
  );
  const [editBody, setEditBody] = useState(
    (d.coreClaim as string) || (d.content as string) || ""
  );
  const [showXRay, setShowXRay] = useState(false);
  const [showFlow, setShowFlow] = useState(false);
  const [showRawQuote, setShowRawQuote] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"xray" | "flow" | null>(null);

  const onUpdate = d.onUpdateNode as ((nodeId: string, patch: Record<string, unknown>) => void) | undefined;
  const onDelete = d.onDeleteNode as ((nodeId: string) => void) | undefined;
  const onDuplicate = d.onDuplicateNode as ((nodeId: string) => void) | undefined;
  const onRunXRay = d.onRunXRay as ((nodeId: string) => Promise<void>) | undefined;
  const onRunFlow = d.onRunFlow as ((nodeId: string) => Promise<void>) | undefined;
  const onOpenDocument = d.onOpenDocument as ((nodeId: string) => void) | undefined;

  const handleSaveEdit = () => {
    setIsEditing(false);
    if (!onUpdate) return;
    if (nodeType === "frame") {
      onUpdate(id, { label: editTitle.trim() || "Topic Frame" });
    } else if (nodeType === "note") {
      onUpdate(id, { title: editTitle.trim() || "Note", content: editBody });
    } else {
      onUpdate(id, {
        sourceTitle: editTitle.trim() || "Concept Clip",
        coreClaim: editBody,
      });
    }
  };

  // Spatial Frame Container
  if (nodeType === "frame") {
    const label = (d.label as string) || "Topic Frame";
    return (
      <div
        className={`relative h-full w-full rounded-xl border transition-colors ${
          selected
            ? "border-[#0F62FE] bg-[#EEF4FF]/35"
            : "border-[#D1D5DB] bg-[#FFFFFF]/45"
        }`}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={240}
          minHeight={160}
          lineClassName="border-[#0F62FE]"
          handleClassName="h-2.5 w-2.5 rounded-sm border border-[#0F62FE] bg-white"
        />
        <div className="absolute -top-6 left-0 flex items-center gap-2">
          {isEditing ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              className="rounded border border-[#0F62FE] bg-white px-1.5 py-0.5 text-xs font-semibold text-[#111827] focus:outline-none"
            />
          ) : (
            <span
              onDoubleClick={() => {
                setEditTitle(label);
                setIsEditing(true);
              }}
              className="cursor-text text-xs font-semibold tracking-tight text-[#4B5563]"
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
        className={`w-48 rounded-lg border bg-white px-2.5 py-1.5 shadow-xs ${
          selected ? "border-[#0F62FE] ring-1 ring-[#0F62FE]" : "border-[#E2E5EC]"
        }`}
      >
        <Handle id="left" type="source" position={Position.Left} className="h-2! w-2! bg-[#0F62FE]!" />
        <p className="truncate font-serif text-xs font-medium text-[#111827]">{headline}</p>
        <Handle id="right" type="source" position={Position.Right} className="h-2! w-2! bg-[#0F62FE]!" />
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

  return (
    <div className="group relative w-64 select-text">
      {/* Floating FictionFlow-Inspired Contextual Pill Above Selected Card */}
      {selected && !isEditing && (
        <div className="nodrag absolute -top-9 left-0 z-20 flex items-center gap-0.5 rounded-full border border-[#E2E5EC] bg-white px-1.5 py-1 shadow-md">
          {nodeType === "concept" && (
            <>
              <button
                disabled={loadingAction === "xray"}
                onClick={async () => {
                  if (xrayBullets) {
                    setShowXRay(!showXRay);
                    return;
                  }
                  if (!onRunXRay) return;
                  setLoadingAction("xray");
                  await onRunXRay(id);
                  setLoadingAction(null);
                  setShowXRay(true);
                }}
                title="Plain-English X-Ray"
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  showXRay
                    ? "bg-[#0F62FE] text-white"
                    : "text-[#374151] hover:bg-[#F3F4F6]"
                }`}
              >
                {loadingAction === "xray" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                X-Ray
              </button>

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
                title="Causal Micro-Flow"
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  showFlow
                    ? "bg-[#0F62FE] text-white"
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
                    ? "bg-[#0F62FE] text-white"
                    : "text-[#4B5563] hover:bg-[#F3F4F6]"
                }`}
              >
                <Quote className="h-3 w-3" />
              </button>
            </>
          )}

          {(nodeType === "note" || nodeType === "concept") && (
            <button
              onClick={() => {
                setEditTitle((d.title as string) || (d.sourceTitle as string) || "");
                setEditBody((d.coreClaim as string) || (d.content as string) || "");
                setIsEditing(true);
              }}
              title="Edit card"
              className="rounded-full p-1 text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]"
            >
              <Edit3 className="h-3 w-3" />
            </button>
          )}

          {onDuplicate && (
            <button
              onClick={() => onDuplicate(id)}
              title="Duplicate card"
              className="rounded-full p-1 text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}

          {onDelete && (
            <button
              onClick={() => onDelete(id)}
              title="Delete card"
              className="rounded-full p-1 text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Quiet External Label Above Top-Left Border */}
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
            className="inline-flex items-center gap-0.5 text-[10px] text-[#0F62FE] hover:underline"
          >
            Link <ArrowUpRight className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      {/* Compact White Card */}
      <div
        className={`rounded-xl border bg-white p-3 transition-all ${
          selected
            ? "border-[#0F62FE] shadow-[0_4px_14px_rgba(15,98,254,0.10)]"
            : "border-[#E2E5EC] shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-[#CBD5E1]"
        }`}
      >
        {/* 4-Way Connection Handles (Loose Connection Mode Ready) */}
        <Handle
          id="left"
          type="source"
          position={Position.Left}
          className="h-2.5! w-2.5! border-2! border-white! bg-[#0F62FE]!"
        />
        <Handle
          id="right"
          type="source"
          position={Position.Right}
          className="h-2.5! w-2.5! border-2! border-white! bg-[#0F62FE]!"
        />
        <Handle
          id="top"
          type="source"
          position={Position.Top}
          className="h-2.5! w-2.5! border-2! border-white! bg-[#0F62FE]!"
        />
        <Handle
          id="bottom"
          type="source"
          position={Position.Bottom}
          className="h-2.5! w-2.5! border-2! border-white! bg-[#0F62FE]!"
        />

        {/* Manual Note Card */}
        {nodeType === "note" && (
          <div>
            {isEditing ? (
              <div className="nodrag space-y-2">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title..."
                  className="w-full border-b border-[#E5E7EB] pb-1 text-xs font-semibold text-[#111827] focus:border-[#0F62FE] focus:outline-none"
                />
                <textarea
                  autoFocus
                  rows={3}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Write a note or hypothesis..."
                  className="w-full resize-none rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-2 text-xs leading-relaxed text-[#111827] focus:border-[#0F62FE] focus:outline-none"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveEdit}
                    className="inline-flex items-center gap-1 rounded-md bg-[#0F62FE] px-2.5 py-1 text-[11px] font-medium text-white"
                  >
                    <Check className="h-3 w-3" /> Save
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
                className="cursor-text"
              >
                {typeof d.title === "string" && d.title && (
                  <h4 className="mb-1 text-xs font-semibold text-[#111827]">
                    {d.title}
                  </h4>
                )}
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#4B5563]">
                  {(d.content as string) || "Double-click to write..."}
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
                className="max-h-36 w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] object-contain"
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
          <div className="space-y-2">
            <h4 className="font-serif text-xs font-semibold leading-snug text-[#111827]">
              {(d.title as string) || "Synthesized Research Note"}
            </h4>
            <p className="line-clamp-2 text-[11px] leading-relaxed text-[#6B7280]">
              {((d.markdownContent as string) || "")
                .replace(/^#+\s*/gm, "")
                .slice(0, 140)}
              ...
            </p>
            {onOpenDocument && (
              <button
                onClick={() => onOpenDocument(id)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#111827] px-2.5 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
              >
                <FileText className="h-3 w-3" />
                Open Full Note
              </button>
            )}
          </div>
        )}

        {/* Clip / Concept Card */}
        {nodeType === "concept" && (
          <div>
            {isEditing ? (
              <div className="nodrag space-y-2">
                <textarea
                  autoFocus
                  rows={3}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full resize-none rounded-md border border-[#0F62FE] bg-[#F9FAFB] p-2 font-serif text-xs leading-relaxed text-[#111827] focus:outline-none"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveEdit}
                    className="inline-flex items-center gap-1 rounded-md bg-[#0F62FE] px-2.5 py-1 text-[11px] font-medium text-white"
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
              <div className="mt-2 rounded-lg border border-[#E5E7EB] bg-[#F6F7F9] p-2 text-[11px] text-[#374151]">
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
              <blockquote className="mt-2 border-l-2 border-[#0F62FE] pl-2 text-[11px] italic leading-relaxed text-[#6B7280]">
                "{d.rawText}"
              </blockquote>
            )}
          </div>
        )}

        {/* Compact Topic Tags */}
        {entities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {entities.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-medium text-[#4B5563]"
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