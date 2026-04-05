"use client";
import { useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, getMessagingInstance, firebaseConfig } from "@/lib/firebase/config";
import { useAuth } from "./useAuth";
import toast from "react-hot-toast";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  // Inject firebase config into SW so it can initialize
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then((reg) => {
        // Post config to SW
        reg.active?.postMessage({ type: "FIREBASE_CONFIG", config: firebaseConfig });
      })
      .catch(() => {/* SW registration failure is non-fatal */});
  }, []);

  // Listen for foreground messages
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    getMessagingInstance().then((messaging) => {
      if (!messaging) return;
      unsubscribe = onMessage(messaging, (payload) => {
        const { title, body } = payload.notification || {};
        toast(body || title || "New notification", { icon: "🔔", duration: 5000 });
      });
    });
    return () => unsubscribe?.();
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return false;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return false;

    if (!VAPID_KEY) {
      console.warn("NEXT_PUBLIC_FIREBASE_VAPID_KEY not set — skipping FCM token registration");
      return false;
    }

    try {
      const messaging = await getMessagingInstance();
      if (!messaging || !user) return false;

      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (!token) return false;

      await setDoc(
        doc(db, "fcmTokens", `${user.uid}_web`),
        { uid: user.uid, token, platform: "web", updatedAt: serverTimestamp() },
        { merge: true }
      );
      return true;
    } catch (err) {
      console.error("FCM token error:", err);
      return false;
    }
  };

  return { permission, requestPermission };
}
