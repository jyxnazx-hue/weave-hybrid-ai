# Weave — Hybrid On-Device & Cloud Spatial Research

> Built for the **#BuildHybridAI 2026** Hackathon using React, TypeScript, Vite, Tailwind CSS, and the official Firebase JS SDK (`firebase` v13+ with `firebase/ai`).

Weave is a spatial research canvas designed to synthesize dense scientific and technical literature. It combines local on-device low-latency inference via Chrome Gemini Nano (`PREFER_ON_DEVICE`) for private, offline extraction with heavy cloud-hosted Gemini models (`ONLY_IN_CLOUD`) for cross-source synthesis and multimodal diagram extraction.

---

## Milestone 1: Hybrid AI Verification Workbench

Milestone 1 establishes the core AI routing infrastructure and verification diagnostic workbench before building the spatial canvas.

### Architecture Highlights

1. **Two Distinct Model Tiers (`src/services/aiRouter.ts`)**:
   - **`localFirstModel`** (`InferenceMode.PREFER_ON_DEVICE`):
     - Fallback: `gemini-3.5-flash-lite`
     - Automatic Routing: Snippets under 1,200 characters execute on-device; longer passages automatically route to `cloudHeavyModel`.
     - Tasks: `extractConceptNode`, `generateJargonXRay`, `generateMicroFlow`, `redactSensitiveText`.
   - **`cloudHeavyModel`** (`InferenceMode.ONLY_IN_CLOUD`):
     - Model: `gemini-3.5-flash`
     - Tasks: `synthesizeWeaveBrief` (analyzes 3–8 nodes across sources for consensus, contradictions, and blind spots), `extractDiagramFromImage` (multimodal image prompt with `inlineData`).

2. **Live Provenance Tracking**:
   - Inspects `result.response.inferenceSource` on every `generateContent` call.
   - Live badge confirms whether computation occurred `ON_DEVICE` or `IN_CLOUD`.

3. **Chrome Gemini Nano Safe Inspection & Download**:
   - `checkOnDeviceStatus()` safely inspects `window.LanguageModel?.availability()` (`available`, `downloading`, `downloadable`, `unavailable`).
   - `triggerOnDeviceDownload()` initiates on-device model setup with `downloadprogress` event monitoring.

4. **Security & Production Compliance**:
   - Firebase App Check initialization (`initializeAppCheck` with `ReCaptchaEnterpriseProvider` and debug token support via `self.FIREBASE_APPCHECK_DEBUG_TOKEN`).
   - Local on-device privacy filter (`redactSensitiveText`) scrubs personal names, emails, and API keys before any cloud transmission.

5. **Warm Paper-Editorial UI Aesthetic**:
   - Background: `#FAF9F6` (warm paper texture)
   - Ink: `#1A1918` (deep charcoal)
   - Accents: `#C85A32` (terracotta)
   - Typography: Newsreader serif paired with JetBrains Mono.

---

## Project Structure

```
weave/
├── .env.example              # Firebase & App Check environment template
├── .env                      # Local development configuration
├── index.html                # Editorial typography and favicon setup
├── package.json              # firebase v13+, @xyflow/react, lucide-react, idb-keyval
├── vite.config.ts            # Vite + Tailwind CSS v4 + React plugin
└── src/
    ├── App.tsx               # Milestone 1 Verification Workbench
    ├── index.css             # Tailwind v4 styles, paper shadow, editorial theme
    ├── main.tsx              # React DOM root entry
    ├── components/
    │   ├── HeaderStatusBar.tsx    # Live Chrome Nano status & model download trigger
    │   ├── MicroFlowViewer.tsx    # Interactive 3-box causal flowchart viewer
    │   ├── ProvenanceBadge.tsx    # Live ON_DEVICE vs IN_CLOUD provenance indicator
    │   ├── WorkingNodesPanel.tsx  # Session nodes management & Weave Brief trigger
    │   └── SettingsModal.tsx      # Firebase keys & Chrome Nano flags reference
    ├── services/
    │   ├── aiRouter.ts       # Firebase AI Logic hybrid inference router
    │   ├── firebase.ts       # Firebase App, App Check, and AI service initialization
    │   ├── storage.ts        # IndexedDB persistence via idb-keyval
    │   └── sampleData.ts     # Pre-populated research texts, presets & sample diagram
    └── types/
        └── weave.ts          # Core strict TypeScript data types
```

---

## Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Firebase Environment (Optional for Local Dev)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`. You can also configure your API key directly in the workbench via the Settings modal.

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## Enabling Chrome Gemini Nano On-Device

To test 100% on-device offline inference in Chrome (Canary or Chrome 128+):
1. Navigate to `chrome://flags/#optimization-guide-on-device-model` and set it to **Enabled BypassPrefRequirement**.
2. Navigate to `chrome://flags/#prompt-api-for-gemini-nano` and set it to **Enabled**.
3. Relaunch Chrome.
4. Visit `chrome://components` and click **Check for update** under **Optimization Guide On Device Model**.
5. Return to the Weave Workbench and click **Download Nano** in the status bar.
