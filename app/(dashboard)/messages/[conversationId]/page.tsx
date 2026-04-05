"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  collection, query, orderBy, onSnapshot, addDoc, serverTimestamp,
  doc, getDoc, updateDoc, setDoc, increment,
} from "firebase/firestore";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { PageLoader } from "@/components/ui/Spinner";
import { timeAgo } from "@/lib/utils";
import type { Message, Conversation } from "@/lib/types";

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { profile } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversation metadata
  useEffect(() => {
    if (!profile || !conversationId) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.CONVERSATIONS, conversationId));
        if (snap.exists()) {
          setConversation({ id: snap.id, ...snap.data() } as Conversation);
        } else {
          // Conversation may not exist yet (navigated from profile page)
          setConversation(null);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [profile, conversationId]);

  // Real-time messages listener
  useEffect(() => {
    if (!conversationId) return;
    const q = query(
      collection(db, COLLECTIONS.MESSAGES),
      orderBy("createdAt", "asc")
    );
    // We need to filter by conversationId — using a subcollection approach here
    // Messages stored at /messages with conversationId field
    const q2 = query(
      collection(db, COLLECTIONS.CONVERSATIONS, conversationId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q2, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });
    return unsub;
  }, [conversationId]);

  // Mark as read when conversation opens
  useEffect(() => {
    if (!profile || !conversationId || !conversation) return;
    const unread = conversation.unreadCounts?.[profile.id] || 0;
    if (unread > 0) {
      updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, conversationId), {
        [`unreadCounts.${profile.id}`]: 0,
      }).catch(() => {});
    }
  }, [conversation, profile, conversationId]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!profile || !text.trim() || sending) return;
    const body = text.trim();
    setText("");
    setSending(true);
    try {
      const otherId = conversationId.split("_").find(id => id !== profile.id) || "";

      // Ensure conversation exists
      const convRef = doc(db, COLLECTIONS.CONVERSATIONS, conversationId);
      const convSnap = await getDoc(convRef);
      if (!convSnap.exists()) {
        await setDoc(convRef, {
          type: "dm",
          participants: conversationId.split("_"),
          participantNames: { [profile.id]: profile.displayName },
          participantPhotos: { [profile.id]: profile.photoURL || "" },
          unreadCounts: conversationId.split("_").reduce((acc, uid) => ({ ...acc, [uid]: 0 }), {}),
          lastMessage: body,
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Add message to subcollection
      await addDoc(collection(db, COLLECTIONS.CONVERSATIONS, conversationId, "messages"), {
        conversationId,
        senderId: profile.id,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL || null,
        body,
        readBy: [profile.id],
        createdAt: serverTimestamp(),
      });

      // Update conversation metadata
      await updateDoc(convRef, {
        lastMessage: body,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(otherId ? { [`unreadCounts.${otherId}`]: increment(1) } : {}),
        [`unreadCounts.${profile.id}`]: 0,
      });

      if (!conversation) {
        const newSnap = await getDoc(convRef);
        if (newSnap.exists()) setConversation({ id: newSnap.id, ...newSnap.data() } as Conversation);
      }
    } catch (e) { console.error(e); setText(body); }
    finally { setSending(false); }
  };

  if (loading) return <PageLoader />;

  const otherId = conversationId.split("_").find(id => id !== profile?.id) || "";
  const otherName = conversation?.participantNames?.[otherId] || "Member";
  const otherPhoto = conversation?.participantPhotos?.[otherId];

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100 flex-shrink-0">
        <Link href="/messages" className="p-2 rounded-xl hover:bg-white text-slate-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Avatar name={otherName} photoURL={otherPhoto} size="sm" />
        <div>
          <p className="text-sm font-bold text-slate-900">{otherName}</p>
          <p className="text-xs text-slate-400">Direct message</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Avatar name={otherName} photoURL={otherPhoto} size="xl" className="mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-900">{otherName}</p>
            <p className="text-xs text-slate-400 mt-1">Send a message to start the conversation</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.senderId === profile?.id;
          const showAvatar = !isMe && (i === 0 || messages[i - 1].senderId !== msg.senderId);
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
              {!isMe && (
                <div className="w-7 flex-shrink-0">
                  {showAvatar && <Avatar name={msg.senderName} photoURL={(msg as any).senderPhoto} size="xs" />}
                </div>
              )}
              <div className={`max-w-[72%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                {showAvatar && !isMe && (
                  <p className="text-[10px] font-semibold text-slate-500 px-1">{msg.senderName}</p>
                )}
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm shadow-sm"}`}>
                  {msg.body}
                </div>
                <p className="text-[10px] text-slate-400 px-1">{timeAgo(msg.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 pt-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Avatar name={profile?.displayName ?? "?"} photoURL={profile?.photoURL} size="xs" className="flex-shrink-0" />
          <input
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Type a message…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={sending}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
