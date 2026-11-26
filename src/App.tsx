import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
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
  ExternalLink,
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
  Sparkles,
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
  runInlineCursorAI,
} from "./services/aiRouter";
import { clusterNodesByTopic, computeAutoThreadsForNode } from "./services/canvasLogic";
import { CARD_TINTS, CanvasCard, type CardTintKey } from "./components/CanvasCard";
import { DocumentEditor } from "./components/DocumentEditor";
import { LibrarySidebar } from "./components/LibrarySidebar";
import type { WeaveNode } from "./types/weave";

const STORAGE_KEY = "weave-infinite-canvas-v3";

const nodeTypes = {
  concept: CanvasCard,
  note: CanvasCard,
  diagram: CanvasCard,
  document: CanvasCard,
  frame: CanvasCard,
};

const EDGE_RELATIONS = [
  { label: "supports", dash: undefined, color: "#374151" },
  { label: "contradicts", dash: "5 4", color: "#111827" },
  { label: "leads to", dash: undefined, color: "#4B5563" },
  { label: "analogy", dash: "2 3", color: "#6B7280" },
];

interface ContextMenuState {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  nodeId?: string;
  edgeId?: string;
}

function WeaveWorkspace() {
  const { zoomIn, zoomOut, zoomTo, fitView, screenToFlowPosition, setCenter } = useReactFlow();

  const isSidePanel = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("mode") === "sidepanel";
  }, []);

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
        onExpandWithAI,
        onOpenNoteInEditor,
        onOpenDocument,
        ...serializableData
      } = (n.data || {}) as Record<string, unknown>;
      return { ...n, data: serializableData };
    });
    set(STORAGE_KEY, { nodes: cleanNodes, edges }).catch(() => {});
    if (typeof BroadcastChannel !== "undefined") {
  const ch = new BroadcastChannel("weave-sync-channel");
  ch.postMessage({ type: "SYNC_STATE", nodes: cleanNodes, edges });
  ch.close();
}
  }, [nodes, edges, hydrated]);

// Live cross-tab sync between Chrome Side Panel and Full Spatial Canvas
useEffect(() => {
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("weave-sync-channel")
      : null;

  if (channel) {
    channel.onmessage = (event) => {
      if (event.data?.type === "SYNC_STATE") {
        if (Array.isArray(event.data.nodes)) setNodes(event.data.nodes);
        if (Array.isArray(event.data.edges)) setEdges(event.data.edges);
      }
    };
  }

  // Listen for Alt+W pending webpage selection captured by background.js
  const chromeApi = (window as unknown as { chrome?: any }).chrome;
  const processPendingClip = async (pending: {
    text?: string;
    title?: string;
    url?: string;
  }) => {
    if (!pending?.text) return;
    setClipText(pending.text);
    setClipTitle(pending.title || "");
    setClipUrl(pending.url || "");
    chromeApi?.storage?.local?.remove?.("weave_pending_clip");
  };

  if (chromeApi?.storage?.local) {
    chromeApi.storage.local.get("weave_pending_clip", (res: any) => {
      if (res?.weave_pending_clip) processPendingClip(res.weave_pending_clip);
    });
    const listener = (changes: any, area: string) => {
      if (area === "local" && changes.weave_pending_clip?.newValue) {
        processPendingClip(changes.weave_pending_clip.newValue);
      }
    };
    chromeApi.storage.onChanged.addListener(listener);
    return () => {
      channel?.close();
      chromeApi.storage.onChanged.removeListener(listener);
    };
  }

  return () => channel?.close();
}, [setNodes, setEdges]);

// Live cross-tab sync between Chrome Side Panel and Full Spatial Canvas
useEffect(() => {
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("weave-sync-channel")
      : null;

  if (channel) {
    channel.onmessage = (event) => {
      if (event.data?.type === "SYNC_STATE") {
        if (Array.isArray(event.data.nodes)) setNodes(event.data.nodes);
        if (Array.isArray(event.data.edges)) setEdges(event.data.edges);
      }
    };
  }

  // Listen for Alt+W pending webpage selection captured by background.js
  const chromeApi = (window as unknown as { chrome?: any }).chrome;
  const processPendingClip = async (pending: {
    text?: string;
    title?: string;
    url?: string;
  }) => {
    if (!pending?.text) return;
    setClipText(pending.text);
    setClipTitle(pending.title || "");
    setClipUrl(pending.url || "");
    chromeApi?.storage?.local?.remove?.("weave_pending_clip");
  };

  if (chromeApi?.storage?.local) {
    chromeApi.storage.local.get("weave_pending_clip", (res: any) => {
      if (res?.weave_pending_clip) processPendingClip(res.weave_pending_clip);
    });
    const listener = (changes: any, area: string) => {
      if (area === "local" && changes.weave_pending_clip?.newValue) {
        processPendingClip(changes.weave_pending_clip.newValue);
      }
    };
    chromeApi.storage.onChanged.addListener(listener);
    return () => {
      channel?.close();
      chromeApi.storage.onChanged.removeListener(listener);
    };
  }

  return () => channel?.close();
}, [setNodes, setEdges]);

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
  // Node & Edge Mutations
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

  // Ask AI to expand & structure a manual note
  const handleExpandWithAI = useCallback(
    async (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      if (!target) return;
      const currentBody =
        (target.data.content as string) || (target.data.coreClaim as string) || "";
      if (!currentBody.trim()) return;
      const xray = await generateJargonXRay(currentBody);
      const expanded = `${currentBody.trim()}\n\n— AI Key Takeaways —\n${xray.bullets
        .map((b) => `• ${b}`)
        .join("\n")}`;
      handleUpdateNode(nodeId, { content: expanded });
    },
    [nodes, handleUpdateNode]
  );

  // Promote any single note or concept card into the Full-Space Document Editor
  const handleOpenNoteInEditor = useCallback(
    (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      if (!target) return;
      if (target.type === "document") {
        setActiveDocumentId(nodeId);
        return;
      }
      const d = target.data as Record<string, unknown>;
      const title = (d.title as string) || (d.sourceTitle as string) || "Research Note";
      const body =
        (d.content as string) ||
        (d.rawText as string) ||
        (d.coreClaim as string) ||
        "";
      handleUpdateNode(nodeId, {
        nodeType: "document",
        title,
        markdownContent: (d.markdownContent as string) || `# ${title}\n\n${body}`,
        contributingNodeIds: [],
        contributingNodes: [],
        updatedAt: Date.now(),
      });
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, type: "document" } : n))
      );
      setActiveDocumentId(nodeId);
    },
    [nodes, handleUpdateNode, setNodes]
  );

  const handleUpdateEdgeRelation = useCallback(
    (edgeId: string, relation: string, dash?: string, color = "#1f2937") => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId
            ? {
                ...e,
                label: relation,
                style: { stroke: color, strokeWidth: 1.6, strokeDasharray: dash },
                labelStyle: {
                  fill: "#111827",
                  fontSize: 10,
                  fontWeight: 500,
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                },
                labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
              }
            : e
        )
      );
    },
    [setEdges]
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
    (atPos?: { x: number; y: number }, tint: CardTintKey = "white") => {
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
          tint,
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
          tint: "white",
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
          tint: "white",
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
          tint: "white",
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
  // Connections & Context Menus
  // ==========================================

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "default",
            label: "supports",
            style: { stroke: "#374151", strokeWidth: 1.6 },
            labelStyle: {
              fill: "#111827",
              fontSize: 10,
              fontWeight: 500,
              fontFamily: "Plus Jakarta Sans, sans-serif",
            },
            labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
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

  const handleEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        flowX: 0,
        flowY: 0,
        edgeId: edge.id,
      });
    },
    []
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
          onRunInlineAI: runInlineCursorAI,
          onExpandWithAI: handleExpandWithAI,
          onOpenNoteInEditor: handleOpenNoteInEditor,
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
    handleExpandWithAI,
    handleOpenNoteInEditor,
  ]);

  // ==========================================
  // Compact Chrome Side Panel View (?mode=sidepanel)
  // ==========================================
  if (isSidePanel) {
    const fullCanvasUrl =
      (window as unknown as { chrome?: any }).chrome?.runtime?.getURL?.("index.html") ||
      window.location.origin;

    return (
      <div className="flex h-screen w-screen flex-col bg-[#F9FAFB] text-[#111827]">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-4 py-3">
          <span className="font-serif text-base font-semibold text-[#111827]">
            Weave
          </span>
          <a
            href={fullCanvasUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-[#1f2937] px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90"
          >
            Open Canvas <ExternalLink className="h-3 w-3" />
          </a>
        </header>

        <form onSubmit={handleExtractClip} className="border-b border-[#E5E7EB] bg-white p-3 space-y-2">
          <textarea
            rows={3}
            value={clipText}
            onChange={(e) => setClipText(e.target.value)}
            placeholder="Paste or highlight text to capture..."
            className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-2.5 text-xs text-[#111827] placeholder-[#9CA3AF] focus:border-[#1f2937] focus:bg-white focus:outline-none"
          />
          <div className="flex gap-1.5">
            <input
              type="text"
              value={clipTitle}
              onChange={(e) => setClipTitle(e.target.value)}
              placeholder="Source title..."
              className="flex-1 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1 text-xs focus:border-[#1f2937] focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={isExtractingClip || !clipText.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-[#1f2937] px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {isExtractingClip ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Capture
            </button>
          </div>
        </form>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {nodes.filter((n) => n.type !== "frame").map((n) => {
            const d = n.data as Record<string, unknown>;
            return (
              <div key={n.id} className="rounded-xl border border-[#E5E7EB] bg-white p-3 text-xs">
                <div className="font-semibold text-[#374151]">
                  {(d.sourceTitle as string) || (d.title as string) || "Note"}
                </div>
                <p className="mt-1 font-serif text-[#111827]">
                  {(d.coreClaim as string) || (d.content as string)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

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
        onRunInlineAI={runInlineCursorAI}
        onBackToCanvas={() => setActiveDocumentId(null)}
      />
    );
  }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-[#F9FAFB]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleCanvasDrop}
      onClick={() => contextMenu && setContextMenu(null)}
    >
      {/* Top-Left Minimal Wordmark */}
      <div className="fixed left-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white/95 px-3.5 py-2 shadow-xs backdrop-blur-sm">
        <span className="font-serif text-base font-semibold tracking-tight text-[#111827]">
          Weave
        </span>
      </div>

      {/* Top-Right Library Toggle + Vertical Canvas Controls */}
      {!sidebarOpen && (
        <div className="fixed right-4 top-4 z-20 flex flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white/95 shadow-xs backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open Library & Search"
            className="border-b border-[#F3F4F6] p-2.5 text-[#374151] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <PanelRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => zoomIn()}
            title="Zoom In"
            className="border-b border-[#F3F4F6] p-2.5 text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => zoomTo(1)}
            title="Reset Zoom (100%)"
            className="border-b border-[#F3F4F6] p-2.5 text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => fitView({ padding: 0.2 })}
            title="Fit View"
            className="border-b border-[#F3F4F6] p-2.5 text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => zoomOut()}
            title="Zoom Out"
            className="border-b border-[#F3F4F6] p-2.5 text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowShortcuts(true)}
            title="Workspace Guide"
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

      {/* Top-Center Synthesis Pill When Frame or Multiple Cards Are Selected */}
      {cardsForSynthesis.length > 0 && (
        <div className="fixed top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#E5E7EB] bg-white px-4 py-1.5 shadow-md">
          <span className="text-xs font-medium text-[#4B5563]">
            {cardsForSynthesis.length} {cardsForSynthesis.length === 1 ? "item" : "items"} selected
          </span>
          <button
            disabled={isSynthesizing}
            onClick={handleSynthesizeFullNote}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1f2937] px-3.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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

      {/* Bottom-Center Google-Inspired Floating Toolbar (Dark Gray Active Accent) */}
      <div className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white/95 px-2 py-1.5 shadow-md backdrop-blur-sm">
        <button
          onClick={() => setToolMode("select")}
          title="Select & Box-Select (V)"
          className={`rounded-xl p-2 transition-colors ${
            toolMode === "select"
              ? "bg-[#1f2937] text-white"
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
              ? "bg-[#1f2937] text-white"
              : "text-[#4B5563] hover:bg-[#F3F4F6]"
          }`}
        >
          <Hand className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-[#E5E7EB]" />

        <button
          onClick={() => createBlankNote()}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
        >
          <StickyNote className="h-3.5 w-3.5 text-[#374151]" />
          Note
        </button>

        <button
          onClick={() => setClipModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
        >
          <Quote className="h-3.5 w-3.5 text-[#374151]" />
          Clip
        </button>

        <button
          onClick={() => imageInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
        >
          <ImageIcon className="h-3.5 w-3.5 text-[#374151]" />
          Diagram
        </button>

        <button
          onClick={() => createSpatialFrame()}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
        >
          <FolderPlus className="h-3.5 w-3.5 text-[#374151]" />
          Frame
        </button>

        <div className="mx-1 h-5 w-px bg-[#E5E7EB]" />

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
              ? "bg-[#1f2937] text-white"
              : "text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]"
          }`}
        >
          <Crosshair className="h-3.5 w-3.5" />
          Focus
        </button>
      </div>

      {/* Rich Right-Click Context Menu (Canvas, Cards, and Connectors) */}
      {contextMenu && (
        <div
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-52 rounded-xl border border-[#E5E7EB] bg-white p-1.5 text-xs text-[#111827] shadow-lg"
        >
          {contextMenu.edgeId ? (
            <>
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Relationship Type
              </div>
              {EDGE_RELATIONS.map((rel) => (
                <button
                  key={rel.label}
                  onClick={() => {
                    handleUpdateEdgeRelation(contextMenu.edgeId!, rel.label, rel.dash, rel.color);
                    setContextMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left capitalize hover:bg-[#F3F4F6]"
                >
                  <span>{rel.label}</span>
                  <span className="font-mono text-[10px] text-[#9CA3AF]">
                    {rel.dash ? "- - -" : "───"}
                  </span>
                </button>
              ))}
              <div className="my-1 h-px bg-[#F3F4F6]" />
              <button
                onClick={() => {
                  setEdges((eds) => eds.filter((e) => e.id !== contextMenu.edgeId));
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#DC2626] hover:bg-[#FEE2E2]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove Connection
              </button>
            </>
          ) : contextMenu.nodeId ? (
            <>
              <button
                onClick={() => {
                  handleOpenNoteInEditor(contextMenu.nodeId!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <Maximize2 className="h-3.5 w-3.5 text-[#374151]" />
                Open in Full Editor
              </button>
              <button
                onClick={() => {
                  handleExpandWithAI(contextMenu.nodeId!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#374151]" />
                Ask AI to Expand
              </button>
              <div className="my-1 h-px bg-[#F3F4F6]" />
              <div className="flex items-center justify-between px-2.5 py-1">
                <span className="text-[11px] text-[#6B7280]">Card Color</span>
                <div className="flex items-center gap-1">
                  {(Object.keys(CARD_TINTS) as CardTintKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        handleUpdateNode(contextMenu.nodeId!, { tint: key });
                        setContextMenu(null);
                      }}
                      className={`h-3 w-3 rounded-full border ${CARD_TINTS[key].swatch}`}
                    />
                  ))}
                </div>
              </div>
              <div className="my-1 h-px bg-[#F3F4F6]" />
              <button
                onClick={() => {
                  handleDuplicateNode(contextMenu.nodeId!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <Copy className="h-3.5 w-3.5 text-[#6B7280]" />
                Duplicate
              </button>
              <button
                onClick={() => {
                  handleDeleteNode(contextMenu.nodeId!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#DC2626] hover:bg-[#FEE2E2]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
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
                <StickyNote className="h-3.5 w-3.5 text-[#374151]" />
                New Note Here
              </button>
              <button
                onClick={() => {
                  setClipModalOpen(true);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <Quote className="h-3.5 w-3.5 text-[#374151]" />
                Clip Text
              </button>
              <button
                onClick={() => {
                  imageInputRef.current?.click();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <ImageIcon className="h-3.5 w-3.5 text-[#374151]" />
                Upload Diagram
              </button>
              <button
                onClick={() => {
                  createSpatialFrame({ x: contextMenu.flowX, y: contextMenu.flowY });
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[#F3F4F6]"
              >
                <FolderPlus className="h-3.5 w-3.5 text-[#374151]" />
                New Spatial Frame
              </button>
              <div className="my-1 h-px bg-[#F3F4F6]" />
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
            className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xl"
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
                placeholder="Paste highlighted text from an article, paper, or book..."
                className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-xs leading-relaxed text-[#111827] placeholder-[#9CA3AF] focus:border-[#1f2937] focus:bg-white focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={clipTitle}
                  onChange={(e) => setClipTitle(e.target.value)}
                  placeholder="Source title (optional)"
                  className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1.5 text-xs text-[#111827] placeholder-[#9CA3AF] focus:border-[#1f2937] focus:bg-white focus:outline-none"
                />
                <input
                  type="url"
                  value={clipUrl}
                  onChange={(e) => setClipUrl(e.target.value)}
                  placeholder="Source URL (optional)"
                  className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1.5 text-xs text-[#111827] placeholder-[#9CA3AF] focus:border-[#1f2937] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClipModalOpen(false)}
                className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:text-[#111827]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isExtractingClip || !clipText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f2937] px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
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

      {/* Workspace Guide Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="w-full max-w-sm rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">
                Workspace Guide
              </h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-[#6B7280] hover:text-[#111827]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2 text-xs text-[#4B5563]">
              <li>• <strong>V / H:</strong> Switch between Select cursor and Hand Pan tool.</li>
              <li>• <strong>Type / inside a note:</strong> Insert headings, checklists, quotes, or Ask AI.</li>
              <li>• <strong>Right-click any connector line:</strong> Set relationship (<em>supports, contradicts, leads to, analogy</em>).</li>
              <li>• <strong>Hover or select any card:</strong> Change tint color, resize corners, Ask AI, or open in Full Editor.</li>
              <li>• <strong>Select Frame or multiple cards:</strong> Click <em>Synthesize Full Note</em>.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Smooth #F9FAFB Infinite Canvas (No Grid) */}
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
        onEdgeContextMenu={handleEdgeContextMenu}
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
      />
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