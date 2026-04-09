"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  collection, query, orderBy, onSnapshot, addDoc, serverTimestamp,
  doc, getDoc, updateDoc, setDoc, increment, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { ArrowLeft, Send, Smile } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { PageLoader } from "@/components/ui/Spinner";
import { timeAgo } from "@/lib/utils";
import type { Message, Conversation } from "@/lib/types";

const REACTION_EMOJIS = ["❤️", "👍", "😂", "🙏", "🔥"];

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { profile } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [otherUser, setOtherUser] = useState<{ displayName: string; photoURL?: string } | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerFor(null);
      }
    };
    if (pickerFor) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [pickerFor]);

  // Load conversation metadata
  useEffect(() => {
    if (!profile || !conversationId) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.CONVERSATIONS, conversationId));
        if (snap.exists()) {
          setConversation({ id: snap.id, ...snap.data() } as Conversation);
        } else {
          const otherId = conversationId.split("_").find(id => id !== profile.id) || "";
          if (otherId) {
            const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, otherId));
            if (userSnap.exists()) {
              const data = userSnap.data();
              setOtherUser({ displayName: data.displayName, photoURL: data.photoURL });
            }
          }
          setConversation(null);
        }
      } catch {
        setConversation(null);
      } finally { setLoading(false); }
    };
    load();
  }, [profile, conversationId]);

  // Real-time messages listener
  useEffect(() => {
    if (!conversationId) return;
    const q = query(
      collection(db, COLLECTIONS.CONVERSATIONS, conversationId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    }, () => {});
    return unsub;
  }, [conversationId]);

  // Mark as read
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

  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!profile) return;
    setPickerFor(null);
    const msgRef = doc(db, COLLECTIONS.CONVERSATIONS, conversationId, "messages", msgId);
    const msg = messages.find(m => m.id === msgId);
    const existingReactors: string[] = (msg as any)?.reactions?.[emoji] || [];
    const hasReacted = existingReactors.includes(profile.id);
    try {
      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: hasReacted ? arrayRemove(profile.id) : arrayUnion(profile.id),
      });
    } catch (e) { console.error(e); }
  };

  const send = async () => {
    if (!profile || !text.trim() || sending) return;
    const body = text.trim();
    setText("");
    setSending(true);
    try {
      const otherId = conversationId.split("_").find(id => id !== profile.id) || "";
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

      await addDoc(collection(db, COLLECTIONS.CONVERSATIONS, conversationId, "messages"), {
        conversationId,
        senderId: profile.id,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL || null,
        body,
        readBy: [profile.id],
        reactions: {},
        createdAt: serverTimestamp(),
      });

      await updateDoc(convRef, {
        lastMessage: body,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(otherId ? { [`unreadCounts.${otherId}`]: increment(1) } : {}),
        [`unreadCounts.${profile.id}`]: 0,
      });

      if (otherId) {
        await addDoc(collection(db, "notifications"), {
          userId: otherId,
          type: "message",
          title: `${profile.displayName}`,
          body: body.slice(0, 80),
          link: `/messages/${conversationId}`,
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }

      if (!conversation) {
        const newSnap = await getDoc(convRef);
        if (newSnap.exists()) setConversation({ id: newSnap.id, ...newSnap.data() } as Conversation);
      }
    } catch (e) { console.error(e); setText(body); }
    finally { setSending(false); }
  };

  if (loading) return <PageLoader />;

  const otherId = conversationId.split("_").find(id => id !== profile?.id) || "";
  const otherName = conversation?.participantNames?.[otherId] || otherUser?.displayName || "Member";
  const otherPhoto = conversation?.participantPhotos?.[otherId] || otherUser?.photoURL;

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
          const reactions: Record<string, string[]> = (msg as any).reactions || {};
          const hasAnyReaction = Object.values(reactions).some(r => r.length > 0);

          return (
            <div key={msg.id} className={`flex items-end gap-2 group ${isMe ? "justify-end" : "justify-start"}`}>
              {!isMe && (
                <div className="w-7 flex-shrink-0">
                  {showAvatar && <Avatar name={msg.senderName} photoURL={(msg as any).senderPhoto} size="xs" />}
                </div>
              )}

              <div className={`max-w-[72%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                {showAvatar && !isMe && (
                  <p className="text-[10px] font-semibold text-slate-500 px-1">{msg.senderName}</p>
                )}

                <div className="relative flex items-end gap-1">
                  {/* Reaction picker trigger — left of bubble for my messages */}
                  {isMe && (
                    <div className="relative">
                      <button
                        onClick={() => setPickerFor(pickerFor === msg.id ? null : msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                      {pickerFor === msg.id && (
                        <div ref={pickerRef} className="absolute bottom-8 right-0 z-50 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 flex gap-1">
                          {REACTION_EMOJIS.map(emoji => {
                            const reactors = reactions[emoji] || [];
                            const mine = reactors.includes(profile?.id || "");
                            return (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-colors ${mine ? "bg-indigo-50" : "hover:bg-slate-100"}`}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm shadow-sm"}`}>
                    {msg.body}
                  </div>

                  {/* Reaction picker trigger — right of bubble for others' messages */}
                  {!isMe && (
                    <div className="relative">
                      <button
                        onClick={() => setPickerFor(pickerFor === msg.id ? null : msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                      {pickerFor === msg.id && (
                        <div ref={pickerRef} className="absolute bottom-8 left-0 z-50 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 flex gap-1">
                          {REACTION_EMOJIS.map(emoji => {
                            const reactors = reactions[emoji] || [];
                            const mine = reactors.includes(profile?.id || "");
                            return (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-colors ${mine ? "bg-indigo-50" : "hover:bg-slate-100"}`}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Reaction pills */}
                {hasAnyReaction && (
                  <div className={`flex flex-wrap gap-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                    {REACTION_EMOJIS.map(emoji => {
                      const reactors = reactions[emoji] || [];
                      if (reactors.length === 0) return null;
                      const mine = reactors.includes(profile?.id || "");
                      return (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
                            mine
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <span>{emoji}</span>
                          <span>{reactors.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

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
