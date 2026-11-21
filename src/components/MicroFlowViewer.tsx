import React from "react";
import { ArrowRight, Layers } from "lucide-react";
import type { MicroFlowNode, MicroFlowEdge } from "../types/weave";

interface MicroFlowViewerProps {
  nodes: MicroFlowNode[];
  edges: MicroFlowEdge[];
  title?: string;
}

export const MicroFlowViewer: React.FC<MicroFlowViewerProps> = ({
  nodes,
  edges,
  title = "3-Box Causal Micro-Flow",
}) => {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-[#FAF9F6] border border-[#E6E1D6] text-xs text-[#797670] italic text-center">
        No micro-flow nodes available.
      </div>
    );
  }

  // Find connecting edge between nodes if sequential
  const getEdgeBetween = (fromId: string, toId: string) => {
    return edges.find((e) => e.from === fromId && e.to === toId);
  };

  return (
    <div className="rounded-xl border border-[#E6E1D6] bg-white p-4 paper-shadow">
      <div className="flex items-center justify-between mb-3 border-b border-[#F0EDE6] pb-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#C85A32]" />
          <h4 className="text-xs uppercase tracking-wider font-semibold text-[#4A4844]">
            {title}
          </h4>
        </div>
        <span className="text-[11px] font-mono text-[#797670] bg-[#FAF9F6] px-2 py-0.5 rounded border border-[#E6E1D6]">
          {nodes.length} nodes • {edges.length} edges
        </span>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 my-2">
        {nodes.map((node, index) => {
          const nextNode = nodes[index + 1];
          const edge = nextNode ? getEdgeBetween(node.id, nextNode.id) || edges[index] : null;

          return (
            <React.Fragment key={node.id || index}>
              {/* Node Card */}
              <div className="flex-1 rounded-lg border border-[#DCD6C9] bg-[#FAF9F6] p-3 text-left transition hover:border-[#C85A32] group relative">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#EAE5DA] text-[#1A1918] text-[11px] font-mono font-bold flex items-center justify-center">
                    {node.id || String.fromCharCode(65 + index)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-medium text-[#797670]">
                    Stage {index + 1}
                  </span>
                </div>
                <div className="text-sm font-medium text-[#1A1918] group-hover:text-[#C85A32] transition">
                  {node.label}
                </div>
              </div>

              {/* Edge Relation / Arrow (between nodes) */}
              {index < nodes.length - 1 && (
                <div className="flex md:flex-col items-center justify-center gap-1 py-1 md:py-0 px-2 shrink-0">
                  {edge?.relation && (
                    <span className="text-[10px] font-medium text-[#C85A32] bg-[#F6EDE8] px-2 py-0.5 rounded-full border border-[#E9CABE] text-center max-w-[110px] truncate">
                      {edge.relation}
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-[#A54420] hidden md:block" />
                  <div className="w-full h-px bg-[#E6E1D6] md:hidden" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
