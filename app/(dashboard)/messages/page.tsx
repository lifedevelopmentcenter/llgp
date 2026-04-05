"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { MessageSquare, Plus, Search } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { timeAgo } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import { NewConversationModal } from "./NewConversationModal";

export default function MessagesPage() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, COLLECTIONS.CONVERSATIONS), where("participants", "array-contains", profile.id), orderBy("lastMessageAt", "desc"))
        );
        setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [profile]);

  if (!profile) return null;
  if (loading) return <PageLoader />;

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const otherName = Object.entries(c.participantNames || {}).find(([uid]) => uid !== profile.id)?.[1] || "";
    return otherName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Messages</h1>
          <p className="text-sm text-slate-400 mt-0.5">Direct conversations</p>
        </div>
        <button
          onClick={() => setNewConvOpen(true)}
          className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Search conversations…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Conversation list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="w-6 h-6" />}
          title="No messages yet"
          description="Start a conversation with a community member."
          action={
            <button onClick={() => setNewConvOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" /> New Message
            </button>
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filtered.map((conv, i) => {
            const otherId = conv.participants.find(p => p !== profile.id) || "";
            const otherName = conv.participantNames?.[otherId] || "Unknown";
            const otherPhoto = conv.participantPhotos?.[otherId];
            const unread = conv.unreadCounts?.[profile.id] || 0;
            return (
              <Link
                key={conv.id}
                href={`/messages/${conv.id}`}
                className={`flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors ${i > 0 ? "border-t border-slate-50" : ""}`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar name={otherName} photoURL={otherPhoto} size="md" />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${unread > 0 ? "font-bold text-slate-900" : "font-semibold text-slate-800"}`}>{otherName}</p>
                    {conv.lastMessageAt && (
                      <p className="text-xs text-slate-400 flex-shrink-0 ml-2">{timeAgo(conv.lastMessageAt)}</p>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className={`text-xs truncate mt-0.5 ${unread > 0 ? "text-slate-700 font-medium" : "text-slate-400"}`}>{conv.lastMessage}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <NewConversationModal
        open={newConvOpen}
        onClose={() => setNewConvOpen(false)}
        onCreated={(convId) => { setNewConvOpen(false); window.location.href = `/messages/${convId}`; }}
      />
    </div>
  );
}
