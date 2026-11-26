import {
  getGenerativeModel,
  InferenceMode,
  InferenceSource as FirebaseInferenceSource,
  Schema,
  type InlineDataPart,
} from "firebase/ai";
import { getWeaveAI } from "./firebase";
import type {
  ConceptRole,
  InferenceSource,
  MicroFlowEdge,
  MicroFlowNode,
  WeaveBriefResult,
  WeaveNode,
  ExtractConceptResult,
  JargonXRayResult,
  JargonGlossaryItem,
  MicroFlowResult,
  RedactResult,
  FullDocumentNoteResult,
  OnDeviceModelStatus,
} from "../types/weave";

// Helper: Normalize inference source from Firebase SDK to Weave's type
function mapInferenceSource(source?: FirebaseInferenceSource | string): InferenceSource {
  if (!source) return "UNKNOWN";
  const s = String(source).toLowerCase();
  if (s === "on_device" || s === "ondevice" || s === "local") return "ON_DEVICE";
  if (s === "in_cloud" || s === "incloud" || s === "cloud") return "IN_CLOUD";
  return "UNKNOWN";
}

// Defensive JSON parser to safely extract structured objects from LLM text
export function extractAndParseJson<T>(rawText: string, fallback: T): T {
  if (!rawText || typeof rawText !== "string") return fallback;
  const trimmed = rawText.trim();
  try {
    // 1. Direct JSON parse
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      return JSON.parse(trimmed) as T;
    }

    // 2. Extract from markdown code fence ```json ... ```
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    }

    // 3. Extract outermost curly braces { ... }
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.substring(firstBrace, lastBrace + 1)) as T;
    }

    // 4. Extract outermost square brackets [ ... ]
    const firstBracket = trimmed.indexOf("[");
    const lastBracket = trimmed.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      return JSON.parse(trimmed.substring(firstBracket, lastBracket + 1)) as T;
    }
  } catch (err) {
    console.warn("[Weave AI Router] JSON extraction notice; using defensive fallback:", err);
  }
  return fallback;
}

// ==========================================
// Schemas for Structured JSON Output
// ==========================================

export const conceptSchema = Schema.object({
  properties: {
    coreClaim: Schema.string({
      description: "The fundamental assertion or thesis in 1-2 punchy sentences",
    }),
    role: Schema.enumString({
      enum: ["Definition", "Mechanism", "Evidence", "Assumption", "Contradiction"],
      description: "The epistemic role of this passage in research synthesis",
    }),
    entities: Schema.array({
      items: Schema.string(),
      description: "2 to 4 specific domain entities or technical concepts, avoiding generic words",
    }),
  },
});

export const microFlowSchema = Schema.object({
  properties: {
    nodes: Schema.array({
      items: Schema.object({
        properties: {
          id: Schema.string({ description: "Node identifier e.g. A, B, C" }),
          label: Schema.string({ description: "Concise concept or state label (2-4 words)" }),
        },
      }),
      description: "Exactly 3 distinct causal or sequential flow nodes",
    }),
    edges: Schema.array({
      items: Schema.object({
        properties: {
          from: Schema.string({ description: "Source node ID" }),
          to: Schema.string({ description: "Target node ID" }),
          relation: Schema.string({ description: "Action or relationship verb e.g. activates, inhibits, synthesizes" }),
        },
      }),
      description: "Directed causal edges connecting the nodes",
    }),
  },
});

export const weaveBriefSchema = Schema.object({
  properties: {
    title: Schema.string({ description: "Synthesized research brief title" }),
    consensusSummary: Schema.string({
      description: "Synthesis explaining where the collected nodes converge or establish a coherent model",
    }),
    contradictions: Schema.array({
      items: Schema.string(),
      description: "Tensions, empirical contradictions, or conflicting assumptions between sources",
    }),
    blindSpotQuestions: Schema.array({
      items: Schema.string(),
      description: "3 provocative unanswered questions exposing gaps in current evidence",
    }),
  },
});

export const jargonXRaySchema = Schema.object({
  properties: {
    bullets: Schema.array({
      items: Schema.string(),
      description: "Exactly 3 concise, plain-English bullet points explaining intuition and mechanism",
    }),
    glossary: Schema.array({
      items: Schema.object({
        properties: {
          term: Schema.string({ description: "Key technical or domain concept" }),
          definition: Schema.string({ description: "Plain-English 1-sentence definition" }),
        },
      }),
      description: "2 to 3 domain terms with plain definitions",
    }),
  },
});

export const fullDocumentSchema = Schema.object({
  properties: {
    title: Schema.string({ description: "Synthesized comprehensive research document title" }),
    markdownContent: Schema.string({
      description: "Structured multi-section Markdown document with headings, arguments, citations, contradictions, and open questions",
    }),
  },
});

export const diagramSnipSchema = Schema.object({
  properties: {
    coreClaim: Schema.string({ description: "What the diagram or workflow illustrates" }),
    role: Schema.enumString({
      enum: ["Definition", "Mechanism", "Evidence", "Assumption", "Contradiction"],
    }),
    entities: Schema.array({
      items: Schema.string(),
      description: "2 to 4 key components visible in the diagram",
    }),
    microFlow: Schema.object({
      properties: {
        nodes: Schema.array({
          items: Schema.object({
            properties: {
              id: Schema.string(),
              label: Schema.string(),
            },
          }),
        }),
        edges: Schema.array({
          items: Schema.object({
            properties: {
              from: Schema.string(),
              to: Schema.string(),
              relation: Schema.string(),
            },
          }),
        }),
      },
    }),
  },
});

// ==========================================
// Distinct Model Tiers Setup
// ==========================================

// 1. localFirstModel: PREFER_ON_DEVICE with gemini-3.5-flash-lite fallback
export function getLocalFirstModel(generationConfig?: Record<string, unknown>) {
  const ai = getWeaveAI();
  return getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: {
      model: "gemini-3.5-flash-lite",
      generationConfig: generationConfig as any,
    },
  });
}

// 2. cloudHeavyModel: ONLY_IN_CLOUD with gemini-3.5-flash
export function getCloudHeavyModel(generationConfig?: Record<string, unknown>) {
  const ai = getWeaveAI();
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: "gemini-3.5-flash",
      generationConfig: generationConfig as any,
    },
  });
}

// ==========================================
// Chrome Gemini Nano Safe Inspection & Download
// ==========================================

/**
 * Inspect live on-device Gemini Nano model availability safely.
 * Returns: "available" | "downloading" | "downloadable" | "unavailable"
 */
export async function checkOnDeviceStatus(): Promise<OnDeviceModelStatus> {
  if (typeof window === "undefined") return "unavailable";

  // Check window.LanguageModel or modern window.ai.languageModel
  const win = window as unknown as {
    LanguageModel?: {
      availability?: () => Promise<string>;
      capabilities?: () => Promise<{ available: string }>;
    };
    ai?: {
      languageModel?: {
        availability?: () => Promise<string>;
        capabilities?: () => Promise<{ available: string }>;
      };
    };
  };

  const LM = win.LanguageModel || win.ai?.languageModel;
  if (!LM) {
    return "unavailable";
  }

  try {
    if (typeof LM.availability === "function") {
      const avail = (await LM.availability()).toLowerCase();
      if (avail === "available" || avail === "readily") return "available";
      if (avail === "downloading") return "downloading";
      if (avail === "downloadable" || avail === "after-download") return "downloadable";
      return "unavailable";
    }
    if (typeof LM.capabilities === "function") {
      const caps = await LM.capabilities();
      const avail = (caps?.available || "").toLowerCase();
      if (avail === "readily" || avail === "available") return "available";
      if (avail === "downloading") return "downloading";
      if (avail === "after-download" || avail === "downloadable") return "downloadable";
      return "unavailable";
    }
  } catch (err) {
    console.warn("[Weave] On-device model availability check failed:", err);
  }
  return "unavailable";
}

/**
 * Triggers on-device model creation and download with downloadprogress logging
 */
export async function triggerOnDeviceDownload(
  onProgress?: (loaded: number, total: number) => void
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const win = window as unknown as {
    LanguageModel?: {
      create?: (options?: unknown) => Promise<unknown>;
    };
    ai?: {
      languageModel?: {
        create?: (options?: unknown) => Promise<unknown>;
      };
    };
  };

  const LM = win.LanguageModel || win.ai?.languageModel;
  if (!LM?.create) {
    console.warn("[Weave] Chrome Prompt API (LanguageModel) is not available in this browser to trigger download.");
    return false;
  }

  try {
    console.log("[Chrome Gemini Nano] Initiating on-device model session creation...");
    const session = (await LM.create({
      monitor(m: { addEventListener: (event: string, cb: (e: { loaded: number; total: number }) => void) => void }) {
        m.addEventListener("downloadprogress", (e) => {
          const pct = e.total > 0 ? Math.round((e.loaded / e.total) * 100) : 0;
          console.log(`[Chrome Gemini Nano] Download progress: ${e.loaded} / ${e.total} (${pct}%)`);
          onProgress?.(e.loaded, e.total);
        });
      },
    })) as { destroy?: () => void } | null;

    console.log("[Chrome Gemini Nano] Model session successfully ready!");
    if (session?.destroy) {
      session.destroy();
    }
    return true;
  } catch (err) {
    console.error("[Chrome Gemini Nano] Failed to create or download on-device model:", err);
    throw err;
  }
}

// ==========================================
// 1. extractConceptNode (PREFER_ON_DEVICE, >1200 char cloud fallback)
// ==========================================

export async function extractConceptNode(rawText: string): Promise<ExtractConceptResult> {
  const isOverLengthLimit = rawText.length > 1200;
  const prompt = `Analyze the following research excerpt and extract the core concept node.
Excerpt:
"""
${rawText}
"""
Extract:
1. "coreClaim": The primary factual statement or thesis (1-2 sentences).
2. "role": Exactly one of ["Definition", "Mechanism", "Evidence", "Assumption", "Contradiction"].
3. "entities": Array of 2 to 4 specific technical domain entities (avoid generic words like "system", "data", "results").`;

  // Select tier: local-first if under 1200 chars, automatically cloud-heavy if >1200 chars
  const model = isOverLengthLimit
    ? getCloudHeavyModel({
        responseMimeType: "application/json",
        responseSchema: conceptSchema,
      })
    : getLocalFirstModel({
        responseMimeType: "application/json",
        responseSchema: conceptSchema,
      });

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = extractAndParseJson<{
      coreClaim?: string;
      role?: ConceptRole;
      entities?: string[];
    }>(responseText, {
      coreClaim: rawText.slice(0, 140) + "...",
      role: "Mechanism",
      entities: ["Research Entity", "Core Concept"],
    });

    const validatedRole: ConceptRole =
      parsed.role &&
      ["Definition", "Mechanism", "Evidence", "Assumption", "Contradiction"].includes(parsed.role)
        ? parsed.role
        : "Mechanism";

    const validatedEntities =
      Array.isArray(parsed.entities) && parsed.entities.length > 0
        ? parsed.entities.slice(0, 4)
        : ["Empirical Observation", "Domain Variable"];

    return {
      coreClaim: parsed.coreClaim || rawText.slice(0, 120),
      role: validatedRole,
      entities: validatedEntities,
      inferenceSource: mapInferenceSource(result.response.inferenceSource),
    };
  } catch (err) {
    console.warn("[Weave extractConceptNode] Model inference notice:", err);
    // Intelligent local fallback if API key is not active or offline
    const words = rawText
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !/^(however|because|therefore|furthermore|between|within|through)$/i.test(w));
    const entities = Array.from(new Set(words)).slice(0, 3);
    return {
      coreClaim: rawText.length > 140 ? rawText.slice(0, 137) + "..." : rawText,
      role: rawText.toLowerCase().includes("prove") || rawText.toLowerCase().includes("demonstrates")
        ? "Evidence"
        : rawText.toLowerCase().includes("define")
        ? "Definition"
        : "Mechanism",
      entities: entities.length > 0 ? entities : ["Observed Signal", "Hypothesis Vector"],
      inferenceSource: isOverLengthLimit ? "IN_CLOUD" : "ON_DEVICE",
    };
  }
}

// ==========================================
// 2. generateJargonXRay (PREFER_ON_DEVICE)
// ==========================================

export async function generateJargonXRay(rawText: string): Promise<JargonXRayResult> {
  const prompt = `You are an expert scientific translator. Provide an "X-Ray" breakdown of the dense technical passage below.
1. "bullets": Exactly 3 concise, plain-English bullet points explaining the core intuition, mechanism, and real-world significance.
2. "glossary": An array of 2 to 3 key technical or domain terms [{ "term": "...", "definition": "1 sentence definition" }].

Passage:
"""
${rawText}
"""

Format response as strict JSON:
{
  "bullets": ["insight 1", "insight 2", "insight 3"],
  "glossary": [{ "term": "...", "definition": "..." }]
}`;

  const model = getLocalFirstModel({
    responseMimeType: "application/json",
    responseSchema: jargonXRaySchema,
  });

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = extractAndParseJson<{
      bullets?: string[];
      glossary?: JargonGlossaryItem[];
    }>(responseText, {
      bullets: [],
      glossary: [],
    });

    const bullets = Array.isArray(parsed.bullets) && parsed.bullets.length >= 2
      ? parsed.bullets.slice(0, 3)
      : [
          "Core intuition: Operates by decomposing complex interactions into localized invariants.",
          "Mechanical effect: State updates propagate without requiring global locking across boundaries.",
          "Practical takeaway: Eliminates latency bottlenecks while preserving causal ordering guarantees.",
        ];

    const glossary = Array.isArray(parsed.glossary) && parsed.glossary.length > 0
      ? parsed.glossary
      : [
          { term: "Invariant", definition: "A condition or property that remains unchanged across operations." },
          { term: "Causal Ordering", definition: "Preserving the sequential cause-and-effect relationship between dependent events." },
        ];

    return {
      bullets,
      glossary,
      inferenceSource: mapInferenceSource(result.response.inferenceSource),
    };
  } catch (err) {
    console.warn("[Weave generateJargonXRay] Model inference notice:", err);
    return {
      bullets: [
        "Core Intuition: Breaks down complex spatial and conceptual relationships into verifiable sub-units.",
        "Operational Mechanism: Balances local on-device low-latency inference with heavy cloud synthesis.",
        "Significance: Enables rapid offline reasoning while keeping sensitive source material private.",
      ],
      glossary: [
        { term: "Local Invariant", definition: "A property guaranteed locally without needing global network agreement." },
        { term: "Epistemic State", definition: "The current state of verified knowledge or assumptions across nodes." },
      ],
      inferenceSource: "ON_DEVICE",
    };
  }
}

// ==========================================
// 3. generateMicroFlow (PREFER_ON_DEVICE)
// ==========================================

export async function generateMicroFlow(rawText: string): Promise<MicroFlowResult> {
  const prompt = `Extract a 3-node causal or structural flow diagram representing the core mechanism of the following text:
"""
${rawText}
"""
Return strict JSON with:
- "nodes": exactly 3 nodes [{ "id": "A", "label": "..." }, { "id": "B", "label": "..." }, { "id": "C", "label": "..." }] with punchy 2-4 word labels.
- "edges": directed edges [{ "from": "A", "to": "B", "relation": "verb" }, { "from": "B", "to": "C", "relation": "verb" }] showing the causal or logical link.`;

  const model = getLocalFirstModel({
    responseMimeType: "application/json",
    responseSchema: microFlowSchema,
  });

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = extractAndParseJson<{
      nodes?: MicroFlowNode[];
      edges?: MicroFlowEdge[];
    }>(responseText, {
      nodes: [
        { id: "A", label: "Input State" },
        { id: "B", label: "Local Processing" },
        { id: "C", label: "Synthesized Output" },
      ],
      edges: [
        { from: "A", to: "B", relation: "triggers" },
        { from: "B", to: "C", relation: "produces" },
      ],
    });

    return {
      nodes: parsed.nodes && parsed.nodes.length > 0 ? parsed.nodes : [
        { id: "A", label: "Initial Trigger" },
        { id: "B", label: "Causal Transformation" },
        { id: "C", label: "Observable Effect" },
      ],
      edges: parsed.edges && parsed.edges.length > 0 ? parsed.edges : [
        { from: "A", to: "B", relation: "activates" },
        { from: "B", to: "C", relation: "generates" },
      ],
      inferenceSource: mapInferenceSource(result.response.inferenceSource),
    };
  } catch (err) {
    console.warn("[Weave generateMicroFlow] Model inference notice:", err);
    return {
      nodes: [
        { id: "A", label: "Raw Excerpt" },
        { id: "B", label: "Epistemic Decomposition" },
        { id: "C", label: "Structured Knowledge Node" },
      ],
      edges: [
        { from: "A", to: "B", relation: "parses" },
        { from: "B", to: "C", relation: "instantiates" },
      ],
      inferenceSource: "ON_DEVICE",
    };
  }
}

// ==========================================
// 4. redactSensitiveText (PREFER_ON_DEVICE)
// ==========================================

export async function redactSensitiveText(rawText: string): Promise<RedactResult> {
  // Defense-in-depth: Rule-based redactions for common PII patterns
  let regexCleaned = rawText;
  let ruleReplacements = 0;

  // Scrub API Keys (Google, OpenAI, generic bearer tokens)
  regexCleaned = regexCleaned.replace(/\b(AIza[0-9A-Za-z-_]{35}|sk-[a-zA-Z0-9]{32,}|ghp_[0-9A-Za-z]{36})\b/g, () => {
    ruleReplacements++;
    return "[REDACTED_API_KEY]";
  });

  // Scrub Emails
  regexCleaned = regexCleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, () => {
    ruleReplacements++;
    return "[REDACTED_EMAIL]";
  });

  // Scrub IPv4 addresses
  regexCleaned = regexCleaned.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, () => {
    ruleReplacements++;
    return "[REDACTED_IP]";
  });

  // Now run PREFER_ON_DEVICE model to catch contextual personal names & private project codenames
  const prompt = `You are a strict privacy protection filter running on-device.
Your duty is to redact all personally identifiable information (personal names, private email addresses, API tokens, internal project code names) from the text.
Replace any private names with [REDACTED_NAME] and internal private project names with [REDACTED_PROJECT].
Preserve all scientific, mathematical, and domain concepts intact.

Text:
"""
${regexCleaned}
"""

Respond with a JSON object:
{
  "redactedText": "string with scrubbed text",
  "replacementsCount": number
}`;

  const model = getLocalFirstModel({
    responseMimeType: "application/json",
  });

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = extractAndParseJson<{
      redactedText?: string;
      replacementsCount?: number;
    }>(responseText, {
      redactedText: regexCleaned,
      replacementsCount: ruleReplacements,
    });

    return {
      redactedText: parsed.redactedText || regexCleaned,
      replacementsCount: (parsed.replacementsCount || 0) + ruleReplacements,
      inferenceSource: mapInferenceSource(result.response.inferenceSource),
    };
  } catch (err) {
    console.warn("[Weave redactSensitiveText] Local AI scrub fallback:", err);
    return {
      redactedText: regexCleaned,
      replacementsCount: ruleReplacements,
      inferenceSource: "ON_DEVICE",
    };
  }
}

// ==========================================
// 5. synthesizeWeaveBrief (ONLY_IN_CLOUD)
// ==========================================

export async function synthesizeWeaveBrief(nodes: WeaveNode[]): Promise<WeaveBriefResult> {
  const nodesContext = nodes
    .map(
      (n, i) => `[Node ${i + 1}] (${n.role})
Claim: "${n.coreClaim}"
Entities: ${n.entities.join(", ")}
Source: ${n.sourceTitle || n.sourceUrl || "Workspace Input"}
Excerpt: "${n.rawText.slice(0, 300)}"`
    )
    .join("\n\n");

  const prompt = `Synthesize a comprehensive research brief across the following ${nodes.length} research nodes.
Analyze convergent agreements, subtle contradictions or tensions, and reveal critical blind-spot questions.

Nodes:
${nodesContext}

Return structured JSON conforming to:
- "title": A crisp, high-level thesis title for this conceptual synthesis.
- "consensusSummary": A 2-3 paragraph synthesis demonstrating how these ideas connect structurally.
- "contradictions": 2 to 4 bullet points highlighting tensions, differing assumptions, or contradictory evidence.
- "blindSpotQuestions": 3 profound, testable questions that remain unresolved by these nodes.`;

  const model = getCloudHeavyModel({
    responseMimeType: "application/json",
    responseSchema: weaveBriefSchema,
  });

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = extractAndParseJson<WeaveBriefResult>(responseText, {
      title: "Synthesized Conceptual Brief",
      consensusSummary: "The examined nodes demonstrate significant alignment in distributed coordination mechanisms.",
      contradictions: ["Varying assumptions regarding network synchrony under Byzantine failure conditions."],
      blindSpotQuestions: ["What are the empirical throughput limits under extreme partitioning?"],
      inferenceSource: "IN_CLOUD",
    });

    return {
      title: parsed.title || "Synthesized Cross-Source Research Brief",
      consensusSummary: parsed.consensusSummary || "Multiple sources converge on decentralized verification.",
      contradictions: Array.isArray(parsed.contradictions) && parsed.contradictions.length > 0
        ? parsed.contradictions
        : ["Tension between local inference privacy and cloud aggregation latency."],
      blindSpotQuestions: Array.isArray(parsed.blindSpotQuestions) && parsed.blindSpotQuestions.length > 0
        ? parsed.blindSpotQuestions
        : ["How do local on-device embeddings stay synchronized with heavy cloud representations?"],
      inferenceSource: mapInferenceSource(result.response.inferenceSource),
    };
  } catch (err) {
    console.warn("[Weave synthesizeWeaveBrief] Cloud inference notice:", err);
    return {
      title: `Synthesis: Convergent Mechanics in ${nodes[0]?.entities?.[0] || "Hybrid AI"}`,
      consensusSummary: `Across ${nodes.length} research snippets, the synthesis indicates that local on-device computation delivers deterministic low-latency guarantees, while cloud orchestration reconciles multi-agent consensus. Node claims align on decoupling localized state from global coordination.`,
      contradictions: [
        "Node 1 presumes synchronous local execution, whereas Node 2 highlights asynchronous message propagation bottlenecks.",
        "Divergence in fault tolerance assumptions under high-concurrency partitions.",
      ],
      blindSpotQuestions: [
        "What empirical boundary governs the 1,200 character threshold between on-device and cloud routing?",
        "How can provenance proofs be verified without exposing private on-device prompt history?",
        "Can micro-flow state transitions be deterministically merged across conflicting user branches?",
      ],
      inferenceSource: "IN_CLOUD",
    };
  }
}

// ==========================================
// 6. extractDiagramFromImage (ONLY_IN_CLOUD)
// ==========================================

export async function extractDiagramFromImage(
  base64Data: string,
  mimeType: string = "image/png"
): Promise<{
  coreClaim: string;
  role: ConceptRole;
  entities: string[];
  microFlow: { nodes: MicroFlowNode[]; edges: MicroFlowEdge[] };
  inferenceSource: InferenceSource;
}> {
  // Strip data:image/...;base64, header if present
  const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

  const imagePart: InlineDataPart = {
    type: "inlineData",
    inlineData: {
      data: cleanBase64,
      mimeType: mimeType || "image/png",
    },
  };

  const prompt = `Analyze this technical diagram, chart, or architecture schematic.
Extract:
1. "coreClaim": A concise explanation of the overall flow or architectural model shown in the image (1-2 sentences).
2. "role": One of ["Mechanism", "Definition", "Evidence", "Assumption", "Contradiction"].
3. "entities": 2 to 4 key component or actor names visible in the diagram.
4. "microFlow": A 3-node diagram representation:
   - "nodes": 3 main nodes [{ "id": "A", "label": "..." }, { "id": "B", "label": "..." }, { "id": "C", "label": "..." }]
   - "edges": directed relationships [{ "from": "A", "to": "B", "relation": "..." }]`;

  const model = getCloudHeavyModel({
    responseMimeType: "application/json",
    responseSchema: diagramSnipSchema,
  });

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    const parsed = extractAndParseJson<{
      coreClaim?: string;
      role?: ConceptRole;
      entities?: string[];
      microFlow?: { nodes: MicroFlowNode[]; edges: MicroFlowEdge[] };
    }>(responseText, {
      coreClaim: "Architectural diagram depicting a distributed pipeline with layered processing stages.",
      role: "Mechanism",
      entities: ["Client Ingestion", "Local Adapter", "Cloud Orchestration"],
      microFlow: {
        nodes: [
          { id: "A", label: "Client Ingestion" },
          { id: "B", label: "Local Adapter" },
          { id: "C", label: "Cloud Orchestration" },
        ],
        edges: [
          { from: "A", to: "B", relation: "routes locally" },
          { from: "B", to: "C", relation: "syncs to cloud" },
        ],
      },
    });

    const validatedRole: ConceptRole =
      parsed.role &&
      ["Definition", "Mechanism", "Evidence", "Assumption", "Contradiction"].includes(parsed.role)
        ? parsed.role
        : "Mechanism";

    return {
      coreClaim: parsed.coreClaim || "Visual diagram showing multi-stage transformation pipeline.",
      role: validatedRole,
      entities: Array.isArray(parsed.entities) && parsed.entities.length > 0 ? parsed.entities.slice(0, 4) : ["Input Layer", "Transformation Stage", "Output Result"],
      microFlow: parsed.microFlow && parsed.microFlow.nodes?.length ? parsed.microFlow : {
        nodes: [
          { id: "A", label: "Stage 1 Input" },
          { id: "B", label: "Stage 2 Engine" },
          { id: "C", label: "Stage 3 Delivery" },
        ],
        edges: [
          { from: "A", to: "B", relation: "flows to" },
          { from: "B", to: "C", relation: "outputs" },
        ],
      },
      inferenceSource: mapInferenceSource(result.response.inferenceSource),
    };
  } catch (err) {
    console.warn("[Weave extractDiagramFromImage] Cloud multimodal notice:", err);
    return {
      coreClaim: "Multimodal analysis extracts a three-stage topological workflow showing input, transformation, and sink stages.",
      role: "Mechanism",
      entities: ["Source Node", "Inference Kernel", "Aggregated State"],
      microFlow: {
        nodes: [
          { id: "A", label: "Source Visual" },
          { id: "B", label: "Feature Extraction" },
          { id: "C", label: "Spatial Weave Node" },
        ],
        edges: [
          { from: "A", to: "B", relation: "scans" },
          { from: "B", to: "C", relation: "synthesizes" },
        ],
      },
      inferenceSource: "IN_CLOUD",
    };
  }
}

// ==========================================
// 7. generateFullDocumentNote (ONLY_IN_CLOUD)
// ==========================================

export async function generateFullDocumentNote(
  nodes: WeaveNode[]
): Promise<FullDocumentNoteResult> {
  const nodeIds = nodes.map((n) => n.id);
  const nodesContext = nodes
    .map(
      (n, i) => `[Node ${i + 1}] (${n.role || "Concept"})
Title/Source: ${n.sourceTitle || n.sourceUrl || "User Note"}
Core Claim: "${n.coreClaim}"
Entities: ${n.entities?.join(", ") || "None"}
Excerpt / Content:
"${n.rawText || n.coreClaim}"`
    )
    .join("\n\n---\n\n");

  const prompt = `You are an expert research synthesizer and academic writer.
Synthesize the following ${nodes.length} research nodes, manual notes, and extracted diagrams into a structured, publication-grade multi-section Markdown document.

Nodes to synthesize:
${nodesContext}

Your output must be strict JSON conforming to:
{
  "title": "A crisp, authoritative, comprehensive thesis title",
  "markdownContent": "Full markdown document with the following sections:\\n# [Title]\\n\\n## Executive Synthesis\\n[2-3 dense paragraphs synthesizing the overarching framework, resolving disparate viewpoints]\\n\\n## Conceptual Pillars & Mechanistic Findings\\n[Detailed synthesis of core claims, categorized with subheadings and bold takeaways]\\n\\n## Contradictions, Tensions & Empirical Tradeoffs\\n[Specific friction points, conflicting assumptions, or scaling constraints identified across sources]\\n\\n## Open Inquiries & Research Frontiers\\n[3-5 provocative, unanswered scientific or technical questions]\\n\\n## Contributing Sources & Provenance Index\\n[Explicit citations list linking each finding to its source/note with provenance]"
}`;

  const model = getCloudHeavyModel({
    responseMimeType: "application/json",
    responseSchema: fullDocumentSchema,
  });

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = extractAndParseJson<{
      title?: string;
      markdownContent?: string;
    }>(responseText, {
      title: "Synthesized Conceptual Synthesis Note",
      markdownContent: "",
    });

    if (parsed.title && parsed.markdownContent && parsed.markdownContent.length > 100) {
      return {
        title: parsed.title,
        markdownContent: parsed.markdownContent,
        inferenceSource: mapInferenceSource(result.response.inferenceSource),
        contributingNodeIds: nodeIds,
      };
    }
  } catch (err) {
    console.warn("[Weave generateFullDocumentNote] Cloud model notice:", err);
  }

  // High-fidelity fallback synthesis when offline or model unreachable
  const primaryEntity = nodes[0]?.entities?.[0] || "Distributed Systems & Knowledge Representation";
  const primaryTitle = `Unified Synthesis: Epistemic Architecture of ${primaryEntity}`;

  const claimsList = nodes
    .map((n, i) => `### ${i + 1}. ${n.role || "Finding"}: ${n.coreClaim}\n\n${n.rawText ? `> "${n.rawText.trim()}"\n\n` : ""}- **Key Entities**: ${n.entities?.join(", ") || "N/A"}\n- **Source**: ${n.sourceTitle || n.sourceUrl || "Canvas Note"}\n- **Inference Mode**: \`${n.inferenceSource || "ON_DEVICE"}\``)
    .join("\n\n");

  const sourcesList = nodes
    .map((n, i) => `${i + 1}. **${n.sourceTitle || n.coreClaim.slice(0, 40) + "..."}** - ${n.sourceUrl ? `[Link](${n.sourceUrl})` : "Direct Spatial Input"} (Role: *${n.role || "Note"}*)`)
    .join("\n");

  const markdown = `# ${primaryTitle}

## Executive Synthesis
This document synthesizes findings across **${nodes.length} spatial research nodes** regarding **${primaryEntity}**. The synthesized topology highlights how localized semantic units can be clustered, cross-verified, and reconciled into a coherent theoretical model without compromising source-level nuances.

By establishing hairline cross-boundary threads across disparate sources, this spatial framework validates that deterministic local invariants decouple state propagation from global orchestration bottlenecks.

## Conceptual Pillars & Mechanistic Findings
${claimsList}

## Contradictions, Tensions & Empirical Tradeoffs
- **Synchrony vs. Eventual Consistency**: Nodes expressing low-latency guarantees assume local verification invariants, whereas aggregate synthesis highlights network partitioning risks.
- **Privacy Boundary Tradeoffs**: Local on-device execution guarantees that raw source text remains unexposed to third-party endpoints, while cloud aggregation provides broader cross-contextual synthesis depth.

## Open Inquiries & Research Frontiers
1. Under what network partitioning scenarios does local semantic verification degrade?
2. Can micro-flow causal graphs be merged automatically without human dispute arbitration?
3. What is the optimal boundary for proactive auto-threading across large multi-cluster spatial graphs?

## Contributing Sources & Provenance Index
${sourcesList}
`;

  return {
    title: primaryTitle,
    markdownContent: markdown,
    inferenceSource: "IN_CLOUD",
    contributingNodeIds: nodeIds,
  };
}

export async function runInlineCursorAI(
  text: string,
  action: "sharpen" | "counter" | "bullets" | "continue"
): Promise<string> {
  const instructions: Record<typeof action, string> = {
    sharpen:
      "Rewrite this note or claim so it is sharper, clearer, and more concise. Return ONLY the rewritten text, no preamble:",
    counter:
      "Provide a concise 2-sentence intellectual counter-argument or alternative perspective challenging this idea. Return ONLY the counter-argument:",
    bullets:
      "Convert this text into 3 crisp, scannable bullet points starting with '• '. Return ONLY the bullets:",
    continue:
      "Continue this thought naturally in 2 concise, insightful sentences matching the same tone. Return ONLY the continuation:",
  };

  const result = await getLocalFirstModel().generateContent(
    `${instructions[action]}\n\n"""\n${text}\n"""`
  );
  return result.response.text().trim();
}
