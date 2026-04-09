import { useEffect } from "react";
import { ref, onValue, set, onDisconnect, serverTimestamp } from "firebase/database";
import { rtdb } from "@/lib/firebase/config";
import { useAuth } from "./useAuth";

export function usePresence() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;

    const presenceRef = ref(rtdb, `/presence/${profile.id}`);
    const connectedRef = ref(rtdb, ".info/connected");

    // If user has hidden their online status, mark them as offline and stop
    if (profile.hideOnlineStatus) {
      set(presenceRef, {
        online: false,
        lastSeen: serverTimestamp(),
        displayName: profile.displayName,
        photoURL: profile.photoURL || null,
      });
      return;
    }

    const unsub = onValue(connectedRef, (snap) => {
      if (!snap.val()) return;

      onDisconnect(presenceRef).set({
        online: false,
        lastSeen: serverTimestamp(),
        displayName: profile.displayName,
        photoURL: profile.photoURL || null,
      });

      set(presenceRef, {
        online: true,
        lastSeen: serverTimestamp(),
        displayName: profile.displayName,
        photoURL: profile.photoURL || null,
      });
    });

    return () => {
      unsub();
      set(presenceRef, {
        online: false,
        lastSeen: serverTimestamp(),
        displayName: profile.displayName,
        photoURL: profile.photoURL || null,
      });
    };
  }, [profile?.id, profile?.hideOnlineStatus]);
}
