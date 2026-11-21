/**
 * Core Data Types for Weave: Hybrid On-Device & Cloud Spatial Research App
 * Built for #BuildHybridAI 2026 Hackathon
 */

export type ConceptRole =
  | "Definition"
  | "Mechanism"
  | "Evidence"
  | "Assumption"
  | "Contradiction";

export type InferenceSource = "ON_DEVICE" | "IN_CLOUD" | "UNKNOWN";

export interface MicroFlowNode {
  id: string;
  label: string;
}

export interface MicroFlowEdge {
  from: string;
  to: string;
  relation: string;
}

export interface WeaveNode {
  id: string;
  rawText: string;
  sourceUrl?: string;
  sourceTitle?: string;
  coreClaim: string;
  role: ConceptRole;
  entities: string[]; // 2 to 4 specific domain entities, avoiding generic stop-words
  xrayBullets?: string[]; // 3 plain-English bullet points
  microFlow?: {
    nodes: MicroFlowNode[];
    edges: MicroFlowEdge[];
  };
  inferenceSource: InferenceSource;
  createdAt: number;
}

export interface WeaveBriefResult {
  title: string;
  consensusSummary: string;
  contradictions: string[];
  blindSpotQuestions: string[];
  inferenceSource: InferenceSource;
}

export interface ExtractConceptResult {
  coreClaim: string;
  role: ConceptRole;
  entities: string[];
  inferenceSource: InferenceSource;
}

export interface JargonXRayResult {
  bullets: string[];
  inferenceSource: InferenceSource;
}

export interface MicroFlowResult {
  nodes: MicroFlowNode[];
  edges: MicroFlowEdge[];
  inferenceSource: InferenceSource;
}

export interface RedactResult {
  redactedText: string;
  replacementsCount: number;
  inferenceSource: InferenceSource;
}

export type OnDeviceModelStatus =
  | "available"
  | "downloading"
  | "downloadable"
  | "unavailable";
