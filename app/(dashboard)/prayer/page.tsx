"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useRef, useState } from "react";
import {
  collection, query, orderBy, addDoc, serverTimestamp,
  updateDoc, doc, increment, onSnapshot, where, deleteDoc,
} from "firebase/firestore";
import { Send, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { PageLoader } from "@/components/ui/Spinner";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Comment } from "@/lib/types";

// ── Local shape for prayer posts stored in POSTS collection ──────────────────
interface PrayerPost {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string | null;
  body: string;
  type: "prayer_request";
  prayingCount: number;
  commentCount: number;
  createdAt: any;
}

const TABS = [
  { key: "all",  label: "All Requests" },
  { key: "mine", label: "My Requests" },
] as const;

export default function PrayerWallPage() {
  const { profile } = useAuth();

  // Posts
  const [posts, setPosts]   = useState<PrayerPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [tab, setTab] = useState<"all" | "mine">("all");

  // Composer
  const [body, setBody]           = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [saving, setSaving]       = useState(false);

  // Praying (local deduplication)
  const [prayed, setPrayed] = useState<Set<string>>(new Set());

  // Amen (comment) input per post
  const [amenOpen, setAmenOpen]   = useState<string | null>(null);
  const [amenText, setAmenText]   = useState("");
  const [amenSaving, setAmenSaving] = useState(false);
  const [amenComments, setAmenComments] = useState<Record<string, Comment[]>>({});
  const amenInputRef = useRef<HTMLInputElement>(null);

  // ── Real-time listener ────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.POSTS),
      where("type", "==", "prayer_request"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrayerPost)));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  // ── Submit prayer request ─────────────────────────────────────────────────
  const submit = async () => {
    if (!profile || !body.trim()) return;
    setSaving(true);
    try {
      const data = {
        authorId:     profile.id,
        authorName:   anonymous ? "Anonymous" : profile.displayName,
        authorPhoto:  anonymous ? null : (profile.photoURL ?? null),
        nationName:   anonymous ? null : (profile.nationName ?? null),
        body:         body.trim(),
        type:         "prayer_request" as const,
        prayingCount: 0,
        commentCount: 0,
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
      };
      await addDoc(collection(db, COLLECTIONS.POSTS), data);
      setBody("");
      setAnonymous(false);
      toast.success("Prayer request shared 🙏");
    } catch (e) {
      console.error(e);
      toast.error("Failed to share. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Praying button ────────────────────────────────────────────────────────
  const handlePray = async (postId: string) => {
    if (!profile || prayed.has(postId)) return;
    setPrayed((prev) => new Set([...prev, postId]));
    // Optimistic local update
    setPosts((prev) =>
      prev.map((p) => p.id === postId ? { ...p, prayingCount: p.prayingCount + 1 } : p),
    );
    try {
      await updateDoc(doc(db, COLLECTIONS.POSTS, postId), { prayingCount: increment(1) });
    } catch (e) {
      console.error(e);
      // roll back
      setPrayed((prev) => { const n = new Set(prev); n.delete(postId); return n; });
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, prayingCount: Math.max(0, p.prayingCount - 1) } : p),
      );
    }
  };

  // ── Amen (comment) ────────────────────────────────────────────────────────
  const toggleAmen = (postId: string) => {
    if (amenOpen === postId) {
      setAmenOpen(null);
    } else {
      setAmenOpen(postId);
      setAmenText("");
      setTimeout(() => amenInputRef.current?.focus(), 50);
    }
  };

  const submitAmen = async (postId: string) => {
    if (!profile || !amenText.trim()) return;
    setAmenSaving(true);
    try {
      const data: Omit<Comment, "id"> = {
        parentId:    postId,
        parentType:  "post",
        authorId:    profile.id,
        authorName:  profile.displayName,
        authorPhoto: profile.photoURL ?? undefined,
        body:        amenText.trim(),
        createdAt:   serverTimestamp() as any,
        updatedAt:   serverTimestamp() as any,
      };
      const ref = await addDoc(collection(db, COLLECTIONS.COMMENTS), data);
      setAmenComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] ?? []), { id: ref.id, ...data } as Comment],
      }));
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p),
      );
      setAmenText("");
    } catch (e) {
      console.error(e);
      toast.error("Failed to send Amen.");
    } finally {
      setAmenSaving(false);
    }
  };

  // ── Delete prayer post ───────────────────────────────────────────────────
  const handleDelete = async (postId: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.POSTS, postId));
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = tab === "mine"
    ? posts.filter((p) => p.authorId === profile?.id)
    : posts;

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <PageLoader />;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          🙏 Prayer Wall
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">Lift one another up in prayer</p>
      </div>

      {/* Composer */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Avatar
            name={anonymous ? "?" : (profile?.displayName ?? "?")}
            photoURL={anonymous ? undefined : profile?.photoURL}
            size="sm"
            className="mt-1 flex-shrink-0"
          />
          <Textarea
            placeholder="Share a prayer request…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="flex-1"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          {/* Anonymous toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setAnonymous((v) => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                anonymous ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  anonymous ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
            <span className="text-sm text-slate-500">Post anonymously</span>
          </label>

          <Button
            onClick={submit}
            loading={saving}
            disabled={!body.trim()}
          >
            Share Request
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
              tab === t.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Prayer cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center space-y-2">
          <p className="text-3xl">🙏</p>
          <p className="text-sm font-semibold text-slate-700">No prayer requests yet.</p>
          <p className="text-sm text-slate-400">Share yours above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => {
            const isPraying = prayed.has(post.id);
            const isAmenOpen = amenOpen === post.id;

            return (
              <div
                key={post.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
              >
                <div className="p-4">
                  {/* Author row */}
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar
                      name={post.authorName}
                      photoURL={post.authorPhoto ?? undefined}
                      size="sm"
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">
                        {post.authorName}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {timeAgo(post.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        🙏 Prayer
                      </span>
                      {(post.authorId === profile?.id || profile?.role === "global_admin") && (
                        <button onClick={() => handleDelete(post.id)}
                          className="w-6 h-6 rounded-full hover:bg-rose-50 flex items-center justify-center transition-colors"
                          title="Delete">
                          <Trash2 className="w-3 h-3 text-rose-400" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {post.body}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-50">
                    {/* Praying button */}
                    <button
                      onClick={() => handlePray(post.id)}
                      disabled={isPraying}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                        isPraying
                          ? "bg-indigo-100 text-indigo-700 cursor-default"
                          : "hover:bg-indigo-50 text-slate-500 hover:text-indigo-700"
                      }`}
                    >
                      <span className="text-base leading-none">🙏</span>
                      {isPraying ? "Praying" : "Praying"}
                      {post.prayingCount > 0 && (
                        <span className={`ml-0.5 font-bold ${isPraying ? "text-indigo-700" : "text-slate-400"}`}>
                          {post.prayingCount}
                        </span>
                      )}
                    </button>

                    {/* Amen button */}
                    <button
                      onClick={() => toggleAmen(post.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                        isAmenOpen
                          ? "bg-amber-100 text-amber-700"
                          : "hover:bg-slate-100 text-slate-500"
                      }`}
                    >
                      <span className="text-base leading-none">✝️</span>
                      Amen
                      {post.commentCount > 0 && (
                        <span className="ml-0.5 text-slate-400 font-bold">
                          {post.commentCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Amen comment section */}
                {isAmenOpen && (
                  <div className="border-t border-slate-50 bg-slate-50/50 px-4 py-3 space-y-2">
                    {/* Existing amens */}
                    {(amenComments[post.id] ?? []).map((c) => (
                      <div key={c.id} className="flex gap-2.5">
                        <Avatar
                          name={c.authorName}
                          photoURL={c.authorPhoto}
                          size="xs"
                          className="flex-shrink-0 mt-0.5"
                        />
                        <div className="bg-white rounded-xl px-3 py-2 shadow-sm flex-1">
                          <p className="text-xs font-bold text-slate-900">{c.authorName}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{c.body}</p>
                        </div>
                      </div>
                    ))}

                    {/* Input */}
                    <div className="flex gap-2 items-center pt-1">
                      <Avatar
                        name={profile?.displayName ?? "?"}
                        photoURL={profile?.photoURL}
                        size="xs"
                        className="flex-shrink-0"
                      />
                      <input
                        ref={amenOpen === post.id ? amenInputRef : undefined}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Say Amen or leave an encouraging word…"
                        value={amenText}
                        onChange={(e) => setAmenText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submitAmen(post.id);
                          }
                        }}
                      />
                      <button
                        onClick={() => submitAmen(post.id)}
                        disabled={!amenText.trim() || amenSaving}
                        className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center transition-colors flex-shrink-0"
                      >
                        <Send className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
