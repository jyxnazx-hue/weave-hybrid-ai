import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  ConnectionMode,
  type Edge,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { get, set } from "idb-keyval";
import {
  Copy,
  Crosshair,
  FileText,
  FolderPlus,
  Hand,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Maximize2,
  MousePointer2,
  PanelRight,
  Plus,
  Quote,
  RotateCcw,
  StickyNote,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import {
  extractConceptNode,
  extractDiagramFromImage,
  generateFullDocumentNote,
  generateJargonXRay,
  generateMicroFlow,
} from "./services/aiRouter";
import { clusterNodesByTopic, computeAutoThreadsForNode } from "./services/canvasLogic";
import { CanvasCard } from "./components/CanvasCard";
import { DocumentEditor } from "./components/DocumentEditor";
import { LibrarySidebar } from "./components/LibrarySidebar";
import type { WeaveNode } from "./types/weave";

const STORAGE_KEY = "weave-infinite-canvas-v2";

const nodeTypes = {
  concept: CanvasCard,
  note: CanvasCard,
  diagram: CanvasCard,
  document: CanvasCard,
  frame: CanvasCard,
};

interface ContextMenuState {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  nodeId?: string;
}

function WeaveWorkspace() {
  const { zoomIn, zoomOut, zoomTo, fitView, screenToFlowPosition, setCenter } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [hydrated, setHydrated] = useState(false);

  // Tool & UI States
  const [toolMode, setToolMode] = useState<"select" | "pan">("select");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusModeActive, setFocusModeActive] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Clip Modal State
  const [clipModalOpen, setClipModalOpen] = useState(false);
  const [clipText, setClipText] = useState("");
  const [clipTitle, setClipTitle] = useState("");
  const [clipUrl, setClipUrl] = useState("");
  const [isExtractingClip, setIsExtractingClip] = useState(false);

  // Document Editor State
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Load persisted canvas
  useEffect(() => {
    (async () => {
      try {
        const saved = await get<{ nodes: Node[]; edges: Edge[] }>(STORAGE_KEY);
        if (saved?.nodes) setNodes(saved.nodes);
        if (saved?.edges) setEdges(saved.edges);
      } catch (err) {
        console.warn("Storage load notice:", err);
      } finally {
        setHydrated(true);
      }
    })();
  }, [setNodes, setEdges]);

  // Auto-save canvas
  useEffect(() => {
    if (!hydrated) return;
    const cleanNodes = nodes.map((n) => {
      const {
        onUpdateNode,
        onDeleteNode,
        onDuplicateNode,
        onRunXRay,
        onRunFlow,
        onOpenDocument,
        ...serializableData
      } = (n.data || {}) as Record<string, unknown>;
      return { ...n, data: serializableData };
    });
    set(STORAGE_KEY, { nodes: cleanNodes, edges }).catch(() => {});
  }, [nodes, edges, hydrated]);

  // Keyboard shortcuts (V = Select, H = Hand Pan)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key.toLowerCase() === "v") setToolMode("select");
      if (e.key.toLowerCase() === "h") setToolMode("pan");
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ==========================================
  // Node Mutations
  // ==========================================

  const handleUpdateNode = useCallback(
    (nodeId: string, patch: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
        )
      );
    },
    [setNodes]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges]
  );

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        const orig = nds.find((n) => n.id === nodeId);
        if (!orig) return nds;
        const newId = `${orig.type || "node"}-${Date.now()}`;
        const copy: Node = {
          ...orig,
          id: newId,
          selected: false,
          position: { x: orig.position.x + 36, y: orig.position.y + 36 },
          data: { ...orig.data, id: newId, createdAt: Date.now() },
        };
        return [...nds, copy];
      });
    },
    [setNodes]
  );

  const handleRunXRay = useCallback(
    async (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      if (!target) return;
      const raw =
        (target.data.rawText as string) || (target.data.coreClaim as string) || "";
      if (!raw) return;
      const res = await generateJargonXRay(raw);
      handleUpdateNode(nodeId, {
        xrayBullets: res.bullets,
        xrayGlossary: res.glossary,
      });
    },
    [nodes, handleUpdateNode]
  );

  const handleRunFlow = useCallback(
    async (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      if (!target) return;
      const raw =
        (target.data.rawText as string) || (target.data.coreClaim as string) || "";
      if (!raw) return;
      const res = await generateMicroFlow(raw);
      handleUpdateNode(nodeId, {
        microFlow: { nodes: res.nodes, edges: res.edges },
      });
    },
    [nodes, handleUpdateNode]
  );

  // ==========================================
  // Creation Actions
  // ==========================================

  const getViewportCenter = useCallback(() => {
    return screenToFlowPosition({
      x: window.innerWidth / 2 - (sidebarOpen ? 120 : 0),
      y: window.innerHeight / 2 - 40,
    });
  }, [screenToFlowPosition, sidebarOpen]);

  const createBlankNote = useCallback(
    (atPos?: { x: number; y: number }) => {
      const pos = atPos || getViewportCenter();
      const id = `note-${Date.now()}`;
      const newNode: Node = {
        id,
        type: "note",
        position: { x: pos.x - 128, y: pos.y - 60 },
        data: {
          nodeType: "note",
          id,
          title: "Note",
          content: "",
          createdAt: Date.now(),
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [getViewportCenter, setNodes]
  );

  const createSpatialFrame = useCallback(
    (atPos?: { x: number; y: number }) => {
      const pos = atPos || getViewportCenter();
      const id = `frame-${Date.now()}`;
      const newFrame: Node = {
        id,
        type: "frame",
        position: { x: pos.x - 220, y: pos.y - 160 },
        style: { width: 460, height: 340, zIndex: -1 },
        data: {
          nodeType: "frame",
          id,
          label: "Topic Frame",
          width: 460,
          height: 340,
          createdAt: Date.now(),
        },
      };
      setNodes((nds) => [newFrame, ...nds]);
    },
    [getViewportCenter, setNodes]
  );

  const createBlankDocument = useCallback(() => {
    const pos = getViewportCenter();
    const id = `doc-${Date.now()}`;
    const newDoc: Node = {
      id,
      type: "document",
      position: { x: pos.x - 128, y: pos.y - 60 },
      data: {
        nodeType: "document",
        id,
        title: "Untitled Note",
        markdownContent: "# Untitled Note\n\nStart writing here...",
        contributingNodeIds: [],
        contributingNodes: [],
        inferenceSource: "ON_DEVICE",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
    setNodes((nds) => [...nds, newDoc]);
    setActiveDocumentId(id);
  }, [getViewportCenter, setNodes]);

  const handleExtractClip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clipText.trim() || isExtractingClip) return;
    setIsExtractingClip(true);
    try {
      const extracted = await extractConceptNode(clipText.trim());
      const pos = getViewportCenter();
      const id = `concept-${Date.now()}`;
      const newNode: Node = {
        id,
        type: "concept",
        position: { x: pos.x - 128, y: pos.y - 60 },
        data: {
          nodeType: "concept",
          id,
          rawText: clipText.trim(),
          sourceTitle: clipTitle.trim() || "Clip",
          sourceUrl: clipUrl.trim() || undefined,
          coreClaim: extracted.coreClaim,
          role: extracted.role,
          entities: extracted.entities,
          inferenceSource: extracted.inferenceSource,
          createdAt: Date.now(),
        },
      };

      setNodes((prev) => {
        const autoEdges = computeAutoThreadsForNode(newNode, prev, edges);
        if (autoEdges.length > 0) {
          setEdges((eds) => [...eds, ...autoEdges]);
        }
        return [...prev, newNode];
      });

      setClipText("");
      setClipTitle("");
      setClipUrl("");
      setClipModalOpen(false);
    } finally {
      setIsExtractingClip(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const extracted = await extractDiagramFromImage(base64, file.type);
      const pos = getViewportCenter();
      const id = `diagram-${Date.now()}`;
      const newNode: Node = {
        id,
        type: "diagram",
        position: { x: pos.x - 128, y: pos.y - 80 },
        data: {
          nodeType: "diagram",
          id,
          imageBase64: base64,
          mimeType: file.type,
          coreClaim: extracted.coreClaim,
          role: extracted.role,
          entities: extracted.entities,
          microFlow: extracted.microFlow,
          inferenceSource: extracted.inferenceSource,
          createdAt: Date.now(),
        },
      };

      setNodes((prev) => {
        const autoEdges = computeAutoThreadsForNode(newNode, prev, edges);
        if (autoEdges.length > 0) {
          setEdges((eds) => [...eds, ...autoEdges]);
        }
        return [...prev, newNode];
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ==========================================
  // Multi-Card / Frame Synthesis -> Full Note
  // ==========================================

  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);

  const cardsForSynthesis = useMemo(() => {
    if (selectedNodes.length === 0) return [];
    const collected = new Map<string, Node>();

    for (const sel of selectedNodes) {
      if (sel.type === "frame") {
        const fx = sel.position.x;
        const fy = sel.position.y;
        const fw = Number(sel.style?.width || sel.data?.width || 460);
        const fh = Number(sel.style?.height || sel.data?.height || 340);

        for (const candidate of nodes) {
          if (candidate.type === "frame" || candidate.type === "document") continue;
          const cx = candidate.position.x + 128;
          const cy = candidate.position.y + 50;
          if (cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh) {
            collected.set(candidate.id, candidate);
          }
        }
      } else if (sel.type !== "document") {
        collected.set(sel.id, sel);
      }
    }
    return Array.from(collected.values());
  }, [selectedNodes, nodes]);

  const handleSynthesizeFullNote = async () => {
    if (cardsForSynthesis.length === 0 || isSynthesizing) return;
    setIsSynthesizing(true);
    try {
      const prepared: WeaveNode[] = cardsForSynthesis.map((n) => {
        const d = n.data as Record<string, unknown>;
        const rawText =
          (d.rawText as string) ||
          (d.content as string) ||
          (d.coreClaim as string) ||
          "";
        const coreClaim =
          (d.coreClaim as string) ||
          (d.title as string) ||
          rawText.slice(0, 140);

        return {
          id: n.id,
          rawText,
          sourceUrl: d.sourceUrl as string | undefined,
          sourceTitle: (d.sourceTitle as string) || (d.title as string) || "Card",
          coreClaim,
          role: (d.role as any) || "Mechanism",
          entities: Array.isArray(d.entities) ? (d.entities as string[]) : [],
          inferenceSource: (d.inferenceSource as any) || "ON_DEVICE",
          createdAt: Number(d.createdAt || Date.now()),
        };
      });

      const docResult = await generateFullDocumentNote(prepared);
      const pos = getViewportCenter();
      const docId = `doc-${Date.now()}`;

      const docNode: Node = {
        id: docId,
        type: "document",
        position: { x: pos.x - 128, y: pos.y - 60 },
        data: {
          nodeType: "document",
          id: docId,
          title: docResult.title,
          markdownContent: docResult.markdownContent,
          contributingNodeIds: docResult.contributingNodeIds,
          contributingNodes: prepared,
          inferenceSource: docResult.inferenceSource,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      setNodes((prev) => [...prev, docNode]);
      setActiveDocumentId(docId);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // ==========================================
  // Smooth Loose Connections & Context Menu
  // ==========================================

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "default",
            style: { stroke: "#0F62FE", strokeWidth: 1.6 },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("application/weave-node-id");
      if (!draggedId) return;
      const dropPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setNodes((nds) =>
        nds.map((n) =>
          n.id === draggedId
            ? { ...n, position: { x: dropPos.x - 128, y: dropPos.y - 40 } }
            : n
        )
      );
    },
    [screenToFlowPosition, setNodes]
  );

  const handleJumpToNode = useCallback(
    (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      if (!target) return;
      setNodes((nds) =>
        nds.map((n) => ({ ...n, selected: n.id === nodeId }))
      );
      setCenter(target.position.x + 128, target.position.y + 60, {
        zoom: 1,
        duration: 350,
      });
    },
    [nodes, setNodes, setCenter]
  );

  const handlePaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });
    },
    [screenToFlowPosition]
  );

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
        nodeId: node.id,
      });
    },
    [screenToFlowPosition]
  );

  // ==========================================
  // Focus Mode & Search Filtering
  // ==========================================

  const decoratedNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const focusedIds = new Set<string>();

    if (focusModeActive && selectedNodes.length > 0) {
      for (const s of selectedNodes) {
        focusedIds.add(s.id);
        for (const e of edges) {
          if (e.source === s.id) focusedIds.add(e.target);
          if (e.target === s.id) focusedIds.add(e.source);
        }
      }
    }

    return nodes.map((n) => {
      let dimmed = false;
      if (q) {
        const d = n.data as Record<string, unknown>;
        const hay = [
          d.title,
          d.label,
          d.coreClaim,
          d.content,
          d.rawText,
          ...(Array.isArray(d.entities) ? d.entities : []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) dimmed = true;
      } else if (focusModeActive && focusedIds.size > 0 && n.type !== "frame") {
        if (!focusedIds.has(n.id)) dimmed = true;
      }

      return {
        ...n,
        style: {
          ...n.style,
          opacity: dimmed ? 0.2 : 1,
          transition: "opacity 160ms ease",
        },
        data: {
          ...n.data,
          onUpdateNode: handleUpdateNode,
          onDeleteNode: handleDeleteNode,
          onDuplicateNode: handleDuplicateNode,
          onRunXRay: handleRunXRay,
          onRunFlow: handleRunFlow,
          onOpenDocument: (docId: string) => setActiveDocumentId(docId),
        },
      };
    });
  }, [
    nodes,
    edges,
    searchQuery,
    focusModeActive,
    selectedNodes,
    handleUpdateNode,
    handleDeleteNode,
    handleDuplicateNode,
    handleRunXRay,
    handleRunFlow,
  ]);

  const activeDocumentNode = useMemo(
    () => nodes.find((n) => n.id === activeDocumentId),
    [nodes, activeDocumentId]
  );

  if (activeDocumentNode) {
    const docData = activeDocumentNode.data as Record<string, unknown>;
    return (
      <DocumentEditor
        title={(docData.title as string) || "Untitled Document"}
        markdownContent={(docData.markdownContent as string) || ""}
        contributingNodes={
          Array.isArray(docData.contributingNodes)
            ? (docData.contributingNodes as WeaveNode[])
            : []
        }
        onChangeTitle={(newTitle) =>
          handleUpdateNode(activeDocumentNode.id, { title: newTitle })
        }
        onChangeMarkdown={(newMd) =>
          handleUpdateNode(activeDocumentNode.id, {
            markdownContent: newMd,
            updatedAt: Date.now(),
          })
        }
        onBackToCanvas={() => setActiveDocumentId(null)}
      />
    );
  }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-[#F6F7F9]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleCanvasDrop}
      onClick={() => contextMenu && setContextMenu(null)}
    >
      {/* Top-Left Minimal Wordmark */}
      <div className="fixed left-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-[#E2E5EC] bg-white/95 px-3.5 py-2 shadow-xs backdrop-blur-sm">
        <span className="font-serif text-base font-semibold tracking-tight text-[#111827]">
          Weave
        </span>
      </div>

      {/* Top-Right Library Toggle + Vertical Canvas Controls */}
      {!sidebarOpen && (
        <div className="fixed right-4 top-4 z-20 flex flex-col overflow-hidden rounded-xl border border-[#E2E5EC] bg-white/95 shadow-xs backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open Library & Search"
            className="border-b border-[#ECEEF2] p-2.5 text-[#374151] transition-colors hover:bg-[#F3F4F6] hover:text-[#0F62FE]"
          >
            <PanelRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => zoomIn()}
            title="Zoom In"
            className="border-b border-[#ECEEF2] p-2.5 text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => zoomTo(1)}
            title="Reset Zoom (100%)"
            className="border-b border-[#ECEEF2] p-2.5 text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => fitView({ padding: 0.2 })}
            title="Fit View"
            className="border-b border-[#ECEEF2] p-2.5 text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => zoomOut()}
            title="Zoom Out"
            className="border-b border-[#ECEEF2] p-2.5 text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowShortcuts(true)}
            title="Shortcuts & Tips"
            className="p-2.5 text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Right-Hand Collapsible Library Sidebar */}
      <LibrarySidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        nodes={nodes}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectNode={handleJumpToNode}
        onCreateBlankNote={() => createBlankNote()}
        onCreateBlankDocument={createBlankDocument}
      />

      {/* Clean Top-Center Synthesis Pill When Frame or Multiple Cards Are Selected */}
      {cardsForSynthesis.length > 0 && (
        <div className="fixed top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#E2E5EC] bg-white px-4 py-1.5 shadow-md">
          <span className="text-xs font-medium text-[#4B5563]">
            {cardsForSynthesis.length} {cardsForSynthesis.length === 1 ? "item" : "items"} selected
          </span>
          <button
            disabled={isSynthesizing}
            onClick={handleSynthesizeFullNote}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0F62FE] px-3.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSynthesizing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {isSynthesizing ? "Synthesizing..." : "Synthesize Full Note"}
          </button>
        </div>
      )}

      {/* Bottom-Center Floating Toolbar (tldraw / Modern Canvas Style with Select & Pan Cursors) */}
      <div className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-[#E2E5EC] bg-white/95 px-2 py-1.5 shadow-md backdrop-blur-sm">
        {/* Cursor Mode Switcher */}
        <button
          onClick={() => setToolMode("select")}
          title="Select & Box-Select (V)"
          className={`rounded-xl p-2 transition-colors ${
            toolMode === "select"
              ? "bg-[#0F62FE] text-white"
              : "text-[#4B5563] hover:bg-[#F3F4F6]"
          }`}
        >
          <MousePointer2 className="h-4 w-4" />
        </button>

        <button
          onClick={() => setToolMode("pan")}
          title="Hand Pan Tool (H)"
          className={`rounded-xl p-2 transition-colors ${
            toolMode === "pan"
              ? "bg-[#0F62FE] text-white"
              : "text-[#4B5563] hover:bg-[#F3F4F6]"
          }`}
        >
          <Hand className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-[#E5E7EB]" />

        {/* Creation Actions */}
        <button
          onClick={() => createBlankNote()}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
        >
          <StickyNote className="h-3.5 w-3.5 text-[#4B5563]" />
          Note
        </button>

        <button
          onClick={() => setClipModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
        >
          <Quote className="h-3.5 w-3.5 text-[#0F62FE]" />
          Clip
        </button>

        <button
          onClick={() => imageInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
        >
          <ImageIcon className="h-3.5 w-3.5 text-[#4B5563]" />
          Diagram
        </button>

        <button
          onClick={() => createSpatialFrame()}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
        >
          <FolderPlus className="h-3.5 w-3.5 text-[#4B5563]" />
          Frame
        </button>

        <div className="mx-1 h-5 w-px bg-[#E5E7EB]" />

        {/* Spatial Organization */}
        <button
          onClick={() => setNodes((nds) => clusterNodesByTopic(nds))}
          title="Group related cards by topic"
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Cluster
        </button>

        <button
          onClick={() => setFocusModeActive(!focusModeActive)}
          title="Focus on selected card and its connected thread"
          className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${
            focusModeActive
              ? "bg-[#111827] text-white"
              : "text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]"
          }`}
        >
          <Crosshair className="h-3.5 w-3.5" />
          Focus
        </button>
      </div>

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-48 rounded-xl border border-[#E2E5EC] bg-white p-1.5 text-xs text-[#111827] shadow-lg"
        >
          {contextMenu.nodeId ? (
            <>
              <button
                onClick={() => {
                  handleDuplicateNode(contextMenu.nodeId!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <Copy className="h-3.5 w-3.5 text-[#6B7280]" />
                Duplicate Card
              </button>
              <button
                onClick={() => {
                  handleDeleteNode(contextMenu.nodeId!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#DC2626] hover:bg-[#FEE2E2]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Card
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  createBlankNote({ x: contextMenu.flowX, y: contextMenu.flowY });
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <StickyNote className="h-3.5 w-3.5 text-[#6B7280]" />
                New Note Here
              </button>
              <button
                onClick={() => {
                  setClipModalOpen(true);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <Quote className="h-3.5 w-3.5 text-[#0F62FE]" />
                Clip Text
              </button>
              <button
                onClick={() => {
                  imageInputRef.current?.click();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <ImageIcon className="h-3.5 w-3.5 text-[#6B7280]" />
                Upload Diagram
              </button>
              <button
                onClick={() => {
                  createSpatialFrame({ x: contextMenu.flowX, y: contextMenu.flowY });
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <FolderPlus className="h-3.5 w-3.5 text-[#6B7280]" />
                New Spatial Frame
              </button>
              <div className="my-1 h-px bg-[#ECEEF2]" />
              <button
                onClick={() => {
                  setNodes((nds) => clusterNodesByTopic(nds));
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-[#6B7280]" />
                Auto-Cluster Topics
              </button>
              <button
                onClick={() => {
                  fitView({ padding: 0.2 });
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <Maximize2 className="h-3.5 w-3.5 text-[#6B7280]" />
                Fit All to Screen
              </button>
            </>
          )}
        </div>
      )}

      {/* Hidden Diagram File Picker */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Clip Text Modal */}
      {clipModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <form
            onSubmit={handleExtractClip}
            className="w-full max-w-md rounded-2xl border border-[#E2E5EC] bg-white p-5 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">
                Clip Passage to Canvas
              </h3>
              <button
                type="button"
                onClick={() => setClipModalOpen(false)}
                className="text-[#6B7280] hover:text-[#111827]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <textarea
                autoFocus
                required
                rows={4}
                value={clipText}
                onChange={(e) => setClipText(e.target.value)}
                placeholder="Paste highlighted text from an article, paper, or note..."
                className="w-full resize-none rounded-xl border border-[#E2E5EC] bg-[#F6F7F9] p-3 text-xs leading-relaxed text-[#111827] placeholder-[#9CA3AF] focus:border-[#0F62FE] focus:bg-white focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={clipTitle}
                  onChange={(e) => setClipTitle(e.target.value)}
                  placeholder="Source title (optional)"
                  className="rounded-lg border border-[#E2E5EC] bg-[#F6F7F9] px-2.5 py-1.5 text-xs text-[#111827] placeholder-[#9CA3AF] focus:border-[#0F62FE] focus:bg-white focus:outline-none"
                />
                <input
                  type="url"
                  value={clipUrl}
                  onChange={(e) => setClipUrl(e.target.value)}
                  placeholder="Source URL (optional)"
                  className="rounded-lg border border-[#E2E5EC] bg-[#F6F7F9] px-2.5 py-1.5 text-xs text-[#111827] placeholder-[#9CA3AF] focus:border-[#0F62FE] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClipModalOpen(false)}
                className="rounded-lg border border-[#E2E5EC] px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:text-[#111827]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isExtractingClip || !clipText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F62FE] px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {isExtractingClip ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {isExtractingClip ? "Extracting..." : "Add to Canvas"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shortcuts Guide Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="w-full max-w-sm rounded-2xl border border-[#E2E5EC] bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">
                Workspace Controls
              </h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-[#6B7280] hover:text-[#111827]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2 text-xs text-[#4B5563]">
              <li>• <strong>V / H:</strong> Switch between Box-Select cursor and Hand Pan tool.</li>
              <li>• <strong>Drag card edge dots:</strong> Connect any card to any other card.</li>
              <li>• <strong>Right-click canvas or card:</strong> Quick actions menu.</li>
              <li>• <strong>Double-click card or canvas:</strong> Edit inline or spawn a note.</li>
              <li>• <strong>Select Frame or multiple cards:</strong> Click <em>Synthesize Full Note</em>.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Light Whitish-Gray Infinite Canvas */}
      <ReactFlow
        nodes={decoratedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={(e) => {
          setContextMenu(null);
          if (e.detail === 2) createBlankNote();
        }}
        panOnDrag={toolMode === "pan" ? true : [1, 2]}
        selectionOnDrag={toolMode === "select"}
        selectionMode={SelectionMode.Partial}
        panOnScroll
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.1}
          color="#D1D5DB"
        />
      </ReactFlow>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <WeaveWorkspace />
    </ReactFlowProvider>
  );
}