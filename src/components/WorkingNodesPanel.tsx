import React from "react";
import { BookOpen, Sparkles, Trash2, Plus, CheckSquare, Square } from "lucide-react";
import type { WeaveNode } from "../types/weave";
import { ProvenanceBadge } from "./ProvenanceBadge";

interface WorkingNodesPanelProps {
  nodes: WeaveNode[];
  selectedNodeIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteNode: (id: string) => void;
  onAddSampleNodes: () => void;
  onSynthesizeBrief: () => void;
  isSynthesizing: boolean;
}

export const WorkingNodesPanel: React.FC<WorkingNodesPanelProps> = ({
  nodes,
  selectedNodeIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onDeleteNode,
  onAddSampleNodes,
  onSynthesizeBrief,
  isSynthesizing,
}) => {
  const selectedCount = selectedNodeIds.length;
  const isSynthesisReady = selectedCount >= 3 && selectedCount <= 8;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Definition":
        return "bg-[#EBF3FB] text-[#1E5692] border-[#C2DBF2]";
      case "Mechanism":
        return "bg-[#EDF3EF] text-[#2E5E3E] border-[#C2DACB]";
      case "Evidence":
        return "bg-[#F3EBF9] text-[#692E8C] border-[#DAC0EB]";
      case "Assumption":
        return "bg-[#FFF8E7] text-[#8C6200] border-[#F2DCA5]";
      case "Contradiction":
        return "bg-[#FDECEB] text-[#A82B24] border-[#F5BEBA]";
      default:
        return "bg-[#F0EDE6] text-[#4A4844] border-[#DCD6C9]";
    }
  };

  return (
    <div className="bg-white border border-[#E6E1D6] rounded-2xl p-5 paper-shadow flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F0EDE6]">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#C85A32]" />
          <h3 className="font-editorial-serif text-base font-bold text-[#1A1918]">
            Working Knowledge Nodes
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#FAF9F6] border border-[#E6E1D6] text-[#797670]">
            {nodes.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {nodes.length > 0 && (
            <button
              onClick={selectedCount === nodes.length ? onClearSelection : onSelectAll}
              className="text-xs text-[#797670] hover:text-[#1A1918] transition flex items-center gap-1 cursor-pointer"
            >
              {selectedCount === nodes.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>Select All</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onAddSampleNodes}
            className="text-xs font-medium text-[#C85A32] hover:text-[#A54420] transition flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF0EC] border border-[#E9CABE] cursor-pointer"
            title="Load 4 curated research nodes to test synthesis"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Preset Nodes</span>
          </button>
        </div>
      </div>

      {/* Synthesis Action Bar */}
      <div className="mb-4 p-3 rounded-xl bg-[#FAF9F6] border border-[#E6E1D6] flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-[#4A4844]">
          <span className="font-semibold text-[#1A1918]">{selectedCount}</span> of{" "}
          <span className="font-mono">3–8</span> nodes selected for Weave Brief
        </div>

        <button
          onClick={onSynthesizeBrief}
          disabled={!isSynthesisReady || isSynthesizing}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#C85A32] text-white hover:bg-[#A54420] transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            {isSynthesizing
              ? "Synthesizing Brief (Cloud)..."
              : "Synthesize Weave Brief (ONLY_IN_CLOUD)"}
          </span>
        </button>
      </div>

      {/* Node List */}
      <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1 flex-1">
        {nodes.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl border border-dashed border-[#DCD6C9] bg-[#FAF9F6]">
            <p className="text-xs text-[#797670] mb-2 font-editorial-serif italic">
              No nodes saved in working session yet.
            </p>
            <p className="text-[11px] text-[#A09D96] mb-4">
              Clip a concept from the text panel or load sample presets below.
            </p>
            <button
              onClick={onAddSampleNodes}
              className="text-xs font-medium px-3.5 py-1.5 rounded-lg bg-white border border-[#DCD6C9] text-[#1A1918] hover:border-[#C85A32] hover:text-[#C85A32] transition cursor-pointer"
            >
              Load Sample Research Nodes
            </button>
          </div>
        ) : (
          nodes.map((node) => {
            const isSelected = selectedNodeIds.includes(node.id);
            return (
              <div
                key={node.id}
                onClick={() => onToggleSelect(node.id)}
                className={`p-3.5 rounded-xl border transition cursor-pointer relative ${
                  isSelected
                    ? "bg-[#FAF0EC]/60 border-[#C85A32] shadow-sm"
                    : "bg-white border-[#E6E1D6] hover:border-[#D1C9BA]"
                }`}
              >
                {/* Top Row: Selection checkbox, Role, Provenance, Delete */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(node.id)}
                      className="accent-[#C85A32] w-4 h-4 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getRoleBadgeColor(
                        node.role
                      )}`}
                    >
                      {node.role}
                    </span>
                    <ProvenanceBadge source={node.inferenceSource} size="sm" />
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNode(node.id);
                    }}
                    className="text-[#9E9A90] hover:text-[#A82B24] p-1 transition cursor-pointer"
                    title="Remove node from session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Core Claim */}
                <p className="text-xs font-editorial-serif font-medium text-[#1A1918] leading-relaxed mb-2">
                  "{node.coreClaim}"
                </p>

                {/* Entity chips */}
                {node.entities && node.entities.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {node.entities.map((ent, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E6E1D6] text-[#4A4844]"
                      >
                        #{ent}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
