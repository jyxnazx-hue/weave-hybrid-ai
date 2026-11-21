import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";

// Declare global debug token for App Check
declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  }
}

// 1. App Check Debug Token Setup
const debugTokenEnv = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
if (typeof self !== "undefined") {
  if (debugTokenEnv === "true" || debugTokenEnv === true) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  } else if (typeof debugTokenEnv === "string" && debugTokenEnv.length > 0) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugTokenEnv;
  } else if (import.meta.env.DEV) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
}

// 2. Local Storage overrides for testing / development without restarting Vite server
const STORAGE_KEY_API_KEY = "weave_firebase_api_key";
const STORAGE_KEY_PROJECT_ID = "weave_firebase_project_id";
const STORAGE_KEY_APP_ID = "weave_firebase_app_id";

export function getCustomApiKey(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  return import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoKey_WeaveHybridAI2026";
}

export function setCustomApiKey(key: string): void {
  if (typeof window !== "undefined") {
    if (key.trim()) {
      localStorage.setItem(STORAGE_KEY_API_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_API_KEY);
    }
  }
}

export function getFirebaseConfig() {
  const apiKey = getCustomApiKey();
  const projectId = 
    (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY_PROJECT_ID)) ||
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    "weave-hybrid-ai";
  const appId =
    (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY_APP_ID)) ||
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:123456789012:web:abcdef1234567890abcdef";

  return {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
    appId,
  };
}

let firebaseAppInstance: FirebaseApp | null = null;
let appCheckInstance: AppCheck | null = null;
let aiInstance: AI | null = null;

export function getWeaveFirebaseApp(): FirebaseApp {
  if (firebaseAppInstance) return firebaseAppInstance;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseAppInstance = existingApps[0];
  } else {
    firebaseAppInstance = initializeApp(getFirebaseConfig());
  }

  // Initialize App Check if configured or in debug mode
  if (typeof window !== "undefined" && !appCheckInstance) {
    const siteKey = import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY;
    if (siteKey && siteKey.trim()) {
      try {
        appCheckInstance = initializeAppCheck(firebaseAppInstance, {
          provider: new ReCaptchaEnterpriseProvider(siteKey),
          isTokenAutoRefreshEnabled: true,
        });
        console.log("[Firebase App Check] Initialized with ReCaptchaEnterpriseProvider");
      } catch (err) {
        console.warn("[Firebase App Check] Initialization skipped or error:", err);
      }
    }
  }

  return firebaseAppInstance;
}

export function getWeaveAI(): AI {
  if (aiInstance) return aiInstance;
  const app = getWeaveFirebaseApp();
  aiInstance = getAI(app, { backend: new GoogleAIBackend() });
  return aiInstance;
}
