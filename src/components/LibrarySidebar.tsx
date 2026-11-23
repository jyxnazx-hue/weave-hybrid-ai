import React, { useMemo, useState } from "react";
import type { Node } from "@xyflow/react";
import {
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Plus,
  Quote,
  Search,
  StickyNote,
  X,
} from "lucide-react";

interface LibrarySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectNode: (nodeId: string) => void;
  onCreateBlankNote: () => void;
  onCreateBlankDocument: () => void;
}

export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
  isOpen,
  onClose,
  nodes,
  searchQuery,
  onSearchChange,
  onSelectNode,
  onCreateBlankNote,
  onCreateBlankDocument,
}) => {
  const [activeFilter, setActiveFilter] = useState<"all" | "notes" | "documents" | "frames">("all");

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return nodes.filter((node) => {
      const data = node.data as Record<string, unknown>;
      const type = node.type || "note";

      if (activeFilter === "documents" && type !== "document") return false;
      if (activeFilter === "frames" && type !== "frame") return false;
      if (activeFilter === "notes" && type === "frame") return false;

      if (!q) return true;

      const searchable = [
        data.title,
        data.label,
        data.coreClaim,
        data.content,
        data.rawText,
        data.markdownContent,
        ...(Array.isArray(data.entities) ? data.entities : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    });
  }, [nodes, searchQuery, activeFilter]);

  const handleDragStart = (e: React.DragEvent, node: Node) => {
    e.dataTransfer.setData("application/weave-node-id", node.id);
    e.dataTransfer.effectAllowed = "move";
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed right-0 top-0 z-30 flex h-screen w-72 flex-col border-l border-[#E2E5EC] bg-[#FFFFFF]/95 text-[#111827] backdrop-blur-md select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#ECEEF2] px-4 py-3">
        <span className="text-xs font-semibold tracking-wide text-[#4B5563] uppercase">
          Library
        </span>
        <button
          onClick={onClose}
          title="Close Sidebar"
          className="rounded-md p-1 text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Live Search */}
      <div className="px-3 pt-3">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#9CA3AF]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search cards, tags..."
            className="w-full rounded-lg border border-[#E2E5EC] bg-[#F6F7F9] py-1.5 pl-8 pr-7 text-xs text-[#111827] placeholder-[#9CA3AF] focus:border-[#0F62FE] focus:bg-white focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 text-[#9CA3AF] hover:text-[#111827]"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-1.5 px-3 pt-2.5">
        <button
          onClick={onCreateBlankNote}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[#E2E5EC] bg-[#F6F7F9] px-2.5 py-1.5 text-xs font-medium text-[#111827] transition-colors hover:border-[#0F62FE] hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5 text-[#0F62FE]" />
          New Note
        </button>
        <button
          onClick={onCreateBlankDocument}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[#111827] px-2.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          <FileText className="h-3.5 w-3.5" />
          New Doc
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-[#ECEEF2] px-3 pt-3 pb-2 text-[11px]">
        {(["all", "notes", "documents", "frames"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`rounded-md px-2 py-0.5 capitalize transition-colors ${
              activeFilter === tab
                ? "bg-[#EEF4FF] font-semibold text-[#0F62FE]"
                : "text-[#6B7280] hover:bg-[#F3F4F6]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Visual Notes List */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
        {filteredNodes.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#9CA3AF]">
            {nodes.length === 0
              ? "No cards yet. Add a note or clip text from the toolbar."
              : "No matching items."}
          </div>
        ) : (
          filteredNodes.map((node) => {
            const data = node.data as Record<string, unknown>;
            const type = node.type || "note";

            const title =
              (data.title as string) ||
              (data.label as string) ||
              (data.sourceTitle as string) ||
              (type === "diagram" ? "Diagram" : "Concept Clip");

            const preview =
              (data.coreClaim as string) ||
              (data.content as string) ||
              (data.markdownContent as string)?.slice(0, 110) ||
              (type === "frame" ? "Spatial group container" : "Empty note");

            const entities = Array.isArray(data.entities)
              ? (data.entities as string[]).slice(0, 2)
              : [];

            return (
              <div
                key={node.id}
                draggable
                onDragStart={(e) => handleDragStart(e, node)}
                onClick={() => onSelectNode(node.id)}
                className="group cursor-grab rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-2.5 transition-all hover:border-[#0F62FE] hover:bg-white active:cursor-grabbing"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#111827]">
                  {type === "document" && <FileText className="h-3 w-3 shrink-0 text-[#0F62FE]" />}
                  {type === "concept" && <Quote className="h-3 w-3 shrink-0 text-[#0F62FE]" />}
                  {type === "note" && <StickyNote className="h-3 w-3 shrink-0 text-[#4B5563]" />}
                  {type === "diagram" && <ImageIcon className="h-3 w-3 shrink-0 text-[#0F62FE]" />}
                  {type === "frame" && <FolderKanban className="h-3 w-3 shrink-0 text-[#4B5563]" />}
                  <span className="truncate">{title}</span>
                </div>

                {type === "diagram" && typeof data.imageBase64 === "string" && (
                  <img
                    src={data.imageBase64}
                    alt={title}
                    className="mt-1.5 h-14 w-full rounded border border-[#E5E7EB] object-cover"
                  />
                )}

                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#6B7280]">
                  {preview}
                </p>

                {entities.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {entities.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-[#EEF2F6] px-1.5 py-0.5 text-[10px] font-medium text-[#4B5563]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-[#ECEEF2] px-3 py-2 text-[10px] text-[#9CA3AF]">
        Drag any card onto canvas or click to jump
      </div>
    </aside>
  );
};