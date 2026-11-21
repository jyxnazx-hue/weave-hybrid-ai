import type { WeaveNode } from "../types/weave";

export const SAMPLE_TEXTS = {
  distributedConsensus: `In distributed state replication, Conflict-Free Replicated Data Types (CRDTs) achieve strong eventual consistency without requiring centralized consensus locks. By restricting state mutations to semilattices with associative, commutative, and idempotent join operations, arbitrary network partitions can be tolerated. However, under high-throughput concurrent writes, state-based CRDTs suffer from linear payload bloat during synchronization rounds, compelling practical systems to adopt delta-state mutations or hybrid operation-based logging with vector clocks to prune historical causal trees.`,

  quantumPhysics: `Topological quantum computing exploits non-Abelian anyons in two-dimensional electron gases to encode quantum information non-locally within braid topologies. Because topological invariants are inherently immune to continuous local Hamiltonian perturbations, phase errors and thermal decoherence are suppressed exponentially with braid separation distance. The fundamental bottleneck remains experimental verification of Majorana zero modes at semiconductor-superconductor nanowire interfaces, where trivial Andreev bound states frequently mimic topological signatures under tunneling conductance spectroscopy.`,

  longPaperExcerpt: `Modern neuro-symbolic research architectures struggle with the dichotomy between statistical representation learning and deterministic epistemic calibration. While transformer-based large language models demonstrate superhuman pattern matching across high-dimensional semantic spaces, their internal latent activations lack formal grounding against causal counterfactuals. When deployed in autonomous spatial research environments, unstructured generation routinely collapses into plausible hallucinations, particularly when traversing multi-hop causal graphs across disparate literature domains.

To mitigate this epistemic degradation, hybrid spatial architectures decouple high-velocity local on-device perceptual pruning from heavy cloud-hosted cross-source synthesis. On-device compact models, operating directly within the client runtime via hardware-accelerated WebGPU and Neural Processing Units, execute rapid sub-second extraction of epistemic primitives: distinguishing foundational definitions from empirical mechanisms, isolating domain-specific entities, and redacting sensitive research artifacts prior to cloud transmission.

Concurrently, cloud-orchestrated reasoning engines receive sanitized, epistemically annotated concept nodes to construct persistent spatial knowledge hypergraphs. By synthesizing multi-source topological contradictions and surfacing latent blind-spot questions across hundreds of indexed publications, the hybrid topology guarantees strict mathematical provenance tracking while maintaining sub-10ms interactive responsiveness for the research investigator. This symbiotic partitioning marks a decisive departure from legacy monolithic cloud pipelines.`,

  sensitiveLog: `CONFIDENTIAL RESEARCH LOG [INTERNAL ONLY]
Author: Dr. Elena Rostova (elena.rostova@deepmind-internal.org)
Project: Project-Aegis Autonomous Synthesis
Timestamp: 2026-11-21T14:32:00Z
Target API Environment: Firebase AI Logic Cluster staging-04
Master Access Token: AIzaSyB74_WeaveSecDevSecretKey998877665544
Internal Endpoint: 192.168.1.104:8080/v1/projects/weave-hybrid-ai

Observed Incident:
During synchronization of experimental branch aegis-beta-mesh, researcher Marcus Vance (marcus.v@biovault-labs.com) reported unauthorized token leakage when testing client telemetry. The on-device privacy filter must intercept and scrub personal identifiers, email addresses, and secret keys before any payload reaches the cloud aggregator.

Scientific Note:
The core enzymatic binding mechanism of KRAS G12D demonstrates nanomolar affinity with small-molecule inhibitor compound BI-2852, validating the targeted pocket mechanism.`,
};

// Clean sample Base64 diagram (SVG rendered into data URL representing a 3-tier hybrid AI pipeline)
export const SAMPLE_DIAGRAM_BASE64 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="280" viewBox="0 0 600 280">
  <rect width="600" height="280" fill="%23FAF9F6" rx="16"/>
  <rect x="20" y="20" width="560" height="240" fill="%23FFFFFF" stroke="%23E6E1D6" stroke-width="2" rx="12"/>
  
  <!-- Step 1: Client Ingest -->
  <rect x="40" y="80" width="140" height="110" fill="%23F6EDE8" stroke="%23C85A32" stroke-width="2" rx="8"/>
  <text x="110" y="115" font-family="sans-serif" font-size="13" font-weight="bold" fill="%231A1918" text-anchor="middle">Input Text / Image</text>
  <text x="110" y="140" font-family="sans-serif" font-size="11" fill="%23A54420" text-anchor="middle">Local Browser UI</text>
  <text x="110" y="165" font-family="monospace" font-size="10" fill="%23797670" text-anchor="middle">Raw Excerpt</text>

  <!-- Arrow 1 -->
  <path d="M 180 135 L 230 135" stroke="%23C85A32" stroke-width="2" marker-end="url(%23arrow)"/>
  <text x="205" y="125" font-family="sans-serif" font-size="9" fill="%23C85A32" text-anchor="middle">routes</text>

  <!-- Step 2: On-Device Gemini Nano -->
  <rect x="230" y="80" width="140" height="110" fill="%23EDF3EF" stroke="%233FA264" stroke-width="2" rx="8"/>
  <text x="300" y="115" font-family="sans-serif" font-size="13" font-weight="bold" fill="%231A1918" text-anchor="middle">Gemini Nano</text>
  <text x="300" y="140" font-family="sans-serif" font-size="11" fill="%232E5E3E" text-anchor="middle">PREFER_ON_DEVICE</text>
  <text x="300" y="165" font-family="monospace" font-size="10" fill="%23797670" text-anchor="middle">Privacy Scrub &amp; Clip</text>

  <!-- Arrow 2 -->
  <path d="M 370 135 L 420 135" stroke="%233FA264" stroke-width="2"/>
  <text x="395" y="125" font-family="sans-serif" font-size="9" fill="%232E5E3E" text-anchor="middle">syncs</text>

  <!-- Step 3: Cloud Gemini 3.5 Flash -->
  <rect x="420" y="80" width="140" height="110" fill="%23F3EBF9" stroke="%23692E8C" stroke-width="2" rx="8"/>
  <text x="490" y="115" font-family="sans-serif" font-size="13" font-weight="bold" fill="%231A1918" text-anchor="middle">Gemini 3.5 Flash</text>
  <text x="490" y="140" font-family="sans-serif" font-size="11" fill="%23692E8C" text-anchor="middle">ONLY_IN_CLOUD</text>
  <text x="490" y="165" font-family="monospace" font-size="10" fill="%23797670" text-anchor="middle">Spatial Weave Brief</text>

  <!-- Header Banner in SVG -->
  <text x="300" y="52" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="%231A1918" text-anchor="middle">Weave Hybrid AI Inference Pipeline</text>
</svg>`;

export const INITIAL_PRESET_NODES: WeaveNode[] = [
  {
    id: "node_preset_1",
    rawText: SAMPLE_TEXTS.distributedConsensus,
    coreClaim: "CRDTs achieve strong eventual consistency without centralized consensus locks across arbitrary partitions.",
    role: "Mechanism",
    entities: ["CRDT", "Semilattices", "Vector Clocks"],
    inferenceSource: "ON_DEVICE",
    createdAt: Date.now() - 3600000,
    xrayBullets: [
      "Intuition: Changes can be merged in any order without conflicts.",
      "Mechanism: State is structured mathematically so duplicate or out-of-order updates yield the same result.",
      "Takeaway: Eliminates network locking at the expense of synchronization payload growth.",
    ],
    microFlow: {
      nodes: [
        { id: "A", label: "Local Write" },
        { id: "B", label: "Semilattice Join" },
        { id: "C", label: "Converged State" },
      ],
      edges: [
        { from: "A", to: "B", relation: "replicates" },
        { from: "B", to: "C", relation: "resolves" },
      ],
    },
  },
  {
    id: "node_preset_2",
    rawText: SAMPLE_TEXTS.quantumPhysics,
    coreClaim: "Topological invariants protect non-Abelian anyons from thermal decoherence exponentially with braid distance.",
    role: "Evidence",
    entities: ["Majorana Zero Modes", "Non-Abelian Anyons", "Braiding"],
    inferenceSource: "ON_DEVICE",
    createdAt: Date.now() - 2400000,
    xrayBullets: [
      "Intuition: Information is stored in how particles weave around each other rather than in individual particles.",
      "Mechanism: Local environmental disturbances cannot undo the global braid topology.",
      "Takeaway: Offers hardware-level error suppression for quantum computation.",
    ],
    microFlow: {
      nodes: [
        { id: "A", label: "Anyon Initialization" },
        { id: "B", label: "Topological Braid" },
        { id: "C", label: "Protected Output" },
      ],
      edges: [
        { from: "A", to: "B", relation: "weaves" },
        { from: "B", to: "C", relation: "measures" },
      ],
    },
  },
  {
    id: "node_preset_3",
    rawText: SAMPLE_TEXTS.longPaperExcerpt,
    coreClaim: "Hybrid spatial architectures decouple on-device perceptual pruning from heavy cloud cross-source synthesis to eliminate hallucination.",
    role: "Mechanism",
    entities: ["Hybrid AI", "Neuro-symbolic", "Spatial Hypergraphs"],
    inferenceSource: "IN_CLOUD",
    createdAt: Date.now() - 1200000,
    xrayBullets: [
      "Intuition: Fast local models handle private data scrubbing, while large cloud models do heavy synthesis.",
      "Mechanism: Epistemic primitives are extracted in sub-10ms on-device before cloud graph assembly.",
      "Takeaway: Combines offline privacy and speed with large-scale analytical power.",
    ],
    microFlow: {
      nodes: [
        { id: "A", label: "Client Ingestion" },
        { id: "B", label: "On-Device Pruning" },
        { id: "C", label: "Cloud Synthesis" },
      ],
      edges: [
        { from: "A", to: "B", relation: "filters" },
        { from: "B", to: "C", relation: "synthesizes" },
      ],
    },
  },
];
