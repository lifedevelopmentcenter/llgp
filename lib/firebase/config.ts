import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";
import { getDatabase } from "firebase/database";

const cleanEnv = (value: string | undefined) => value?.trim();

// On these hosts the Firebase auth handler is proxied at /__/auth (next.config.ts), so
// the Google sign-in popup stays same-origin. Cross-origin handlers fail in iOS Safari
// with "missing initial state". Each host needs https://<host>/__/auth/handler in the
// OAuth client's authorized redirect URIs.
const SELF_HOSTED_AUTH_HOSTS = ["leadinglightsnetwork.org", "www.leadinglightsnetwork.org"];

const resolveAuthDomain = () => {
  if (typeof window !== "undefined" && SELF_HOSTED_AUTH_HOSTS.includes(window.location.hostname)) {
    return window.location.hostname;
  }
  return cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
};

export const firebaseConfig = {
  apiKey: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: resolveAuthDomain(),
  projectId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  databaseURL: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL),
};

if (typeof window !== "undefined") {
  // Diagnostic: does the bundle have Firebase config? Logs key presence only.
  // eslint-disable-next-line no-console
  console.log("[firebase-config-debug]", {
    apiKey: firebaseConfig.apiKey ? `present (len=${firebaseConfig.apiKey.length})` : "MISSING",
    authDomain: firebaseConfig.authDomain || "MISSING",
    projectId: firebaseConfig.projectId || "MISSING",
    storageBucket: firebaseConfig.storageBucket || "MISSING",
    appId: firebaseConfig.appId ? "present" : "MISSING",
  });
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);

export const getMessagingInstance = async () => {
  if (typeof window === "undefined") return null;
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};

export default app;
