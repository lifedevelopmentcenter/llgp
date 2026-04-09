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

    const unsub = onValue(connectedRef, (snap) => {
      if (!snap.val()) return;

      // When disconnected, mark offline
      onDisconnect(presenceRef).set({
        online: false,
        lastSeen: serverTimestamp(),
        displayName: profile.displayName,
        photoURL: profile.photoURL || null,
      });

      // Mark online now
      set(presenceRef, {
        online: true,
        lastSeen: serverTimestamp(),
        displayName: profile.displayName,
        photoURL: profile.photoURL || null,
      });
    });

    return () => {
      unsub();
      // Mark offline on component unmount (tab close handled by onDisconnect)
      set(presenceRef, {
        online: false,
        lastSeen: serverTimestamp(),
        displayName: profile.displayName,
        photoURL: profile.photoURL || null,
      });
    };
  }, [profile?.id]);
}
