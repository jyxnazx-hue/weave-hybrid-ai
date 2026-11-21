import { get, set, del } from "idb-keyval";
import type { WeaveNode, WeaveBriefResult } from "../types/weave";

const NODES_STORE_KEY = "weave_saved_nodes_m1";
const BRIEFS_STORE_KEY = "weave_saved_briefs_m1";

export async function getStoredNodes(): Promise<WeaveNode[]> {
  try {
    const nodes = await get<WeaveNode[]>(NODES_STORE_KEY);
    return nodes || [];
  } catch (err) {
    console.warn("[Storage] Failed to read nodes from idb:", err);
    return [];
  }
}

export async function saveStoredNodes(nodes: WeaveNode[]): Promise<void> {
  try {
    await set(NODES_STORE_KEY, nodes);
  } catch (err) {
    console.error("[Storage] Failed to save nodes to idb:", err);
  }
}

export async function clearStoredNodes(): Promise<void> {
  try {
    await del(NODES_STORE_KEY);
  } catch (err) {
    console.error("[Storage] Failed to clear nodes in idb:", err);
  }
}

export async function getStoredBriefs(): Promise<WeaveBriefResult[]> {
  try {
    const briefs = await get<WeaveBriefResult[]>(BRIEFS_STORE_KEY);
    return briefs || [];
  } catch (err) {
    console.warn("[Storage] Failed to read briefs from idb:", err);
    return [];
  }
}

export async function saveStoredBriefs(briefs: WeaveBriefResult[]): Promise<void> {
  try {
    await set(BRIEFS_STORE_KEY, briefs);
  } catch (err) {
    console.error("[Storage] Failed to save briefs to idb:", err);
  }
}
