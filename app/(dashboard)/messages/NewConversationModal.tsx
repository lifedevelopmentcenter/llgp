"use client";
import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Search } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import type { UserProfile } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (convId: string) => void;
}

export function NewConversationModal({ open, onClose, onCreated }: Props) {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [starting, setStarting] = useState(false);

  // Load all active users once when modal opens
  useEffect(() => {
    if (!open || allUsers.length > 0) return;
    getDocs(query(collection(db, COLLECTIONS.USERS), where("isActive", "==", true), orderBy("displayName")))
      .then(snap => setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile))))
      .catch(() => {});
  }, [open]);

  const term = search.toLowerCase().trim();
  const results = term.length >= 2
    ? allUsers.filter(u => u.id !== profile?.id && (
        u.displayName?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
      ))
    : [];

  const startConversation = async (other: UserProfile) => {
    if (!profile || starting) return;
    setStarting(true);
    try {
      const convId = [profile.id, other.id].sort().join("_");
      const convRef = doc(db, COLLECTIONS.CONVERSATIONS, convId);
      await setDoc(convRef, {
        type: "dm",
        participants: [profile.id, other.id],
        participantNames: { [profile.id]: profile.displayName, [other.id]: other.displayName },
        participantPhotos: { [profile.id]: profile.photoURL || "", [other.id]: other.photoURL || "" },
        unreadCounts: { [profile.id]: 0, [other.id]: 0 },
        lastMessage: null,
        lastMessageAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      onCreated(convId);
    } catch (e) { console.error(e); }
    finally { setStarting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Message" size="sm">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {results.length === 0 && search.length >= 2 && (
            <p className="text-xs text-slate-400 text-center py-4">No members found</p>
          )}
          {results.map(user => (
            <button
              key={user.id}
              onClick={() => startConversation(user)}
              disabled={starting}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
            >
              <Avatar name={user.displayName ?? "?"} photoURL={user.photoURL} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{user.displayName}</p>
                {user.nationName && <p className="text-xs text-slate-400 truncate">{user.nationName}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
