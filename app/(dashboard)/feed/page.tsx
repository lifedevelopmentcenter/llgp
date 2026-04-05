"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
  collection, query, orderBy, addDoc, serverTimestamp,
  updateDoc, doc, increment, limit, where, getDocs,
  deleteDoc, setDoc,
} from "firebase/firestore";
import {
  Globe, Users, MapPin, Layers, Plus, Heart, ThumbsUp, HandHeart,
  MessageSquare, Send, X, MoreHorizontal, Pencil, Trash2, Flag,
} from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Post, Comment } from "@/lib/types";

const SCOPES = [
  { key: "global", label: "Global", icon: Globe },
  { key: "national", label: "My Nation", icon: MapPin },
  { key: "city", label: "My City", icon: Layers },
];

const POST_TYPES = [
  { key: "all", label: "All" },
  { key: "testimony", label: "Testimony" },
  { key: "prayer_request", label: "Prayer" },
  { key: "update", label: "Update" },
  { key: "insight", label: "Insight" },
];

const TYPE_META: Record<string, { label: string; colors: string; emoji: string }> = {
  testimony:     { label: "Testimony",    colors: "bg-green-100 text-green-700",   emoji: "✦" },
  prayer_request:{ label: "Prayer",       colors: "bg-blue-100 text-blue-700",     emoji: "🙏" },
  update:        { label: "Update",       colors: "bg-amber-100 text-amber-700",   emoji: "📢" },
  insight:       { label: "Insight",      colors: "bg-violet-100 text-violet-700", emoji: "💡" },
  event:         { label: "Event",        colors: "bg-rose-100 text-rose-700",     emoji: "📅" },
  poll:          { label: "Poll",         colors: "bg-cyan-100 text-cyan-700",     emoji: "📊" },
};

export default function FeedPage() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"global" | "national" | "city">("global");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ body: "", type: "update" as Post["type"], scope: "global" as Post["scope"] });
  const [reacted, setReacted] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  // Edit/delete own posts
  const [editPost, setEditPost] = useState<{ id: string; body: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Edit/delete own comments
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  // Read more truncation
  const [expandedBody, setExpandedBody] = useState<Set<string>>(new Set());

  // Post action menu
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Report
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  const loadPosts = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let q;
      if (scope === "national" && profile.nationId) {
        q = query(collection(db, COLLECTIONS.POSTS), where("scope", "==", "national"), where("nationId", "==", profile.nationId), orderBy("createdAt", "desc"), limit(40));
      } else if (scope === "city" && profile.cityId) {
        q = query(collection(db, COLLECTIONS.POSTS), where("scope", "==", "city"), where("cityId", "==", profile.cityId), orderBy("createdAt", "desc"), limit(40));
      } else {
        q = query(collection(db, COLLECTIONS.POSTS), where("scope", "==", "global"), orderBy("createdAt", "desc"), limit(40));
      }
      const snap = await getDocs(q);
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));

      // Load user's reactions for these posts
      const postIds = snap.docs.map(d => d.id);
      if (postIds.length > 0) {
        const rxSnap = await getDocs(query(
          collection(db, COLLECTIONS.REACTIONS),
          where("userId", "==", profile.id),
          where("postId", "in", postIds.slice(0, 30))
        ));
        const rxMap: Record<string, string> = {};
        rxSnap.docs.forEach(d => { rxMap[(d.data() as any).postId] = (d.data() as any).type; });
        setReacted(rxMap);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [profile, scope]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const react = async (postId: string, type: "like" | "heart" | "pray") => {
    if (!profile) return;
    const docId = `${postId}_${profile.id}`;
    const rxRef = doc(db, COLLECTIONS.REACTIONS, docId);
    const current = reacted[postId];
    try {
      if (current === type) {
        // Unreact
        setReacted(prev => { const n = { ...prev }; delete n[postId]; return n; });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactionCounts: { ...p.reactionCounts, [type]: Math.max(0, (p.reactionCounts?.[type] || 0) - 1) } } : p));
        await deleteDoc(rxRef);
        await updateDoc(doc(db, COLLECTIONS.POSTS, postId), { [`reactionCounts.${type}`]: increment(-1) });
      } else {
        // New or switch
        setReacted(prev => ({ ...prev, [postId]: type }));
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          reactionCounts: {
            ...p.reactionCounts,
            [type]: (p.reactionCounts?.[type] || 0) + 1,
            ...(current ? { [current]: Math.max(0, (p.reactionCounts?.[current as keyof typeof p.reactionCounts] || 0) - 1) } : {}),
          }
        } : p));
        await setDoc(rxRef, { postId, postType: "post", userId: profile.id, type, createdAt: serverTimestamp() });
        await updateDoc(doc(db, COLLECTIONS.POSTS, postId), {
          [`reactionCounts.${type}`]: increment(1),
          ...(current ? { [`reactionCounts.${current}`]: increment(-1) } : {}),
        });
      }
    } catch (e) { console.error(e); }
  };

  const loadComments = async (postId: string) => {
    if (comments[postId]) return;
    try {
      const snap = await getDocs(query(collection(db, COLLECTIONS.COMMENTS), where("parentId", "==", postId), orderBy("createdAt")));
      setComments(prev => ({ ...prev, [postId]: snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)) }));
    } catch (e) { console.error(e); }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id); loadComments(id); setCommentText("");
  };

  const addComment = async (postId: string) => {
    if (!profile || !commentText.trim()) return;
    setCommentSaving(true);
    try {
      const data = { parentId: postId, parentType: "post" as const, authorId: profile.id, authorName: profile.displayName, authorPhoto: profile.photoURL || null, body: commentText.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      const ref = await addDoc(collection(db, COLLECTIONS.COMMENTS), data);
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), { id: ref.id, ...data } as any] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
      setCommentText("");
    } catch (e) { toast.error("Failed to comment."); }
    finally { setCommentSaving(false); }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.COMMENTS, commentId));
      setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
    } catch (e) { toast.error("Failed to delete comment."); }
  };

  const submit = async () => {
    if (!profile || !form.body.trim()) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        authorId: profile.id,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL || null,
        nationId: profile.nationId || null,
        nationName: profile.nationName || null,
        cityId: profile.cityId || null,
        cityName: profile.cityName || null,
        commentCount: 0,
        reactionCounts: { like: 0, heart: 0, pray: 0 },
        isPinned: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, COLLECTIONS.POSTS), data);
      if (data.scope === scope || (scope === "global" && data.scope === "global")) {
        setPosts(prev => [{ id: ref.id, ...data } as any, ...prev]);
      }
      setModalOpen(false);
      setForm({ body: "", type: "update", scope: "global" });
      toast.success("Posted!");
    } catch (e) { toast.error("Failed to post."); }
    finally { setSaving(false); }
  };

  const saveEditPost = async () => {
    if (!editPost || !editPost.body.trim()) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.POSTS, editPost.id), { body: editPost.body.trim(), updatedAt: serverTimestamp() });
      setPosts(prev => prev.map(p => p.id === editPost.id ? { ...p, body: editPost.body.trim() } : p));
      setEditPost(null);
      toast.success("Post updated.");
    } catch (e) { toast.error("Failed to update."); }
    finally { setEditSaving(false); }
  };

  const deletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.POSTS, postId));
      setPosts(prev => prev.filter(p => p.id !== postId));
      setDeleteConfirm(null);
      toast.success("Post deleted.");
    } catch (e) { toast.error("Failed to delete."); }
  };

  const submitReport = async () => {
    if (!profile || !reportPostId || !reportReason) return;
    try {
      await addDoc(collection(db, "reports"), { postId: reportPostId, postType: "post", reporterId: profile.id, reporterName: profile.displayName, reason: reportReason, createdAt: serverTimestamp() });
      setReportPostId(null);
      setReportReason("");
      toast.success("Report submitted. Thank you.");
    } catch (e) { toast.error("Failed to submit report."); }
  };

  const filtered = posts.filter(p => typeFilter === "all" || p.type === typeFilter);

  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in" onClick={() => setMenuOpenId(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Feed</h1>
          <p className="text-sm text-slate-400 mt-0.5">Stay connected with the movement</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Post
        </Button>
      </div>

      {/* Compose teaser */}
      <button
        onClick={() => setModalOpen(true)}
        className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-all duration-150 text-left"
      >
        <Avatar name={profile.displayName ?? "?"} photoURL={profile.photoURL} size="sm" />
        <span className="text-sm text-slate-400 flex-1">Share an update with the movement…</span>
        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <Plus className="w-4 h-4 text-white" />
        </div>
      </button>

      {/* Scope tabs */}
      <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 p-1 shadow-sm">
        {SCOPES.map(s => {
          const Icon = s.icon;
          const disabled = (s.key === "national" && !profile.nationId) || (s.key === "city" && !profile.cityId);
          return (
            <button
              key={s.key}
              onClick={() => !disabled && setScope(s.key as any)}
              disabled={disabled}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-150 ${scope === s.key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Type filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        {POST_TYPES.map(t => (
          <button
            key={t.key}
            onClick={() => setTypeFilter(t.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${typeFilter === t.key ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
              <div className="flex gap-3"><div className="w-8 h-8 rounded-full bg-slate-100" /><div className="flex-1 space-y-2"><div className="h-3 bg-slate-100 rounded w-1/3" /><div className="h-3 bg-slate-100 rounded w-3/4" /></div></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Globe className="w-6 h-6" />}
          title="Nothing here yet"
          description="Be the first to post something."
          action={<Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" />Post</Button>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(post => {
            const meta = TYPE_META[post.type] || TYPE_META.update;
            return (
              <div key={post.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4">
                  {/* Author row */}
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar name={post.authorName} photoURL={post.authorPhoto} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900">{post.authorName}</p>
                        {(post.nationName || post.cityName) && (
                          <span className="text-xs text-slate-400">· {[post.cityName, post.nationName].filter(Boolean).join(", ")}</span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.colors}`}>
                          {meta.emoji} {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{timeAgo(post.createdAt)}</p>
                    </div>
                    {/* 3-dot menu */}
                    <div className="relative ml-auto" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === post.id ? null : post.id); }}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {menuOpenId === post.id && (
                        <div className="absolute right-0 top-7 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 min-w-[130px]">
                          {post.authorId === profile.id ? (
                            <>
                              <button onClick={() => { setEditPost({ id: post.id, body: post.body }); setMenuOpenId(null); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Pencil className="w-3.5 h-3.5" />Edit</button>
                              <button onClick={() => { setDeleteConfirm(post.id); setMenuOpenId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" />Delete</button>
                            </>
                          ) : (
                            <button onClick={() => { setReportPostId(post.id); setMenuOpenId(null); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Flag className="w-3.5 h-3.5" />Report</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Post body with read more */}
                  {(() => {
                    const isLong = post.body.length > 180;
                    const isExpanded = expandedBody.has(post.id);
                    return (
                      <div>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                          {isLong && !isExpanded ? post.body.slice(0, 180) + "…" : post.body}
                        </p>
                        {isLong && (
                          <button
                            onClick={() => setExpandedBody(prev => { const n = new Set(prev); isExpanded ? n.delete(post.id) : n.add(post.id); return n; })}
                            className="text-xs text-indigo-600 font-semibold mt-1 hover:underline"
                          >
                            {isExpanded ? "Show less" : "Read more"}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Reactions */}
                  <div className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-50 flex-wrap">
                    {(["like", "heart", "pray"] as const).map(r => {
                      const icons = { like: ThumbsUp, heart: Heart, pray: HandHeart };
                      const labels = { like: "Like", heart: "Amen", pray: "Praying" };
                      const Icon = icons[r];
                      const isActive = reacted[post.id] === r;
                      const count = post.reactionCounts?.[r] || 0;
                      return (
                        <button
                          key={r}
                          onClick={() => react(post.id, r)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${isActive ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-100 text-slate-500"}`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${isActive ? "fill-indigo-500" : ""}`} />
                          {count > 0 ? count : ""} {labels[r]}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => toggleExpand(post.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ml-auto ${expandedId === post.id ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-100 text-slate-500"}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {post.commentCount > 0 ? post.commentCount : ""} Comment
                    </button>
                  </div>
                </div>

                {/* Comments */}
                {expandedId === post.id && (
                  <div className="border-t border-slate-50 bg-slate-50/50 px-4 py-3 space-y-3">
                    {(comments[post.id] || []).map(c => (
                      <div key={c.id} className="flex gap-2.5">
                        <Avatar name={c.authorName} photoURL={c.authorPhoto} size="xs" className="flex-shrink-0 mt-0.5" />
                        <div className="bg-white rounded-xl px-3 py-2 shadow-sm flex-1">
                          <p className="text-xs font-bold text-slate-900">{c.authorName}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{c.body}</p>
                          {c.authorId === profile.id && (
                            <button onClick={() => deleteComment(post.id, c.id)} className="text-[10px] text-red-400 hover:text-red-600 mt-1">delete</button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 items-center pt-1">
                      <Avatar name={profile.displayName ?? "?"} photoURL={profile.photoURL} size="xs" className="flex-shrink-0" />
                      <input
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Write a comment…"
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(post.id); } }}
                      />
                      <button
                        onClick={() => addComment(post.id)}
                        disabled={!commentText.trim() || commentSaving}
                        className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center flex-shrink-0"
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

      {/* Compose Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Share with the movement" size="md">
        <div className="space-y-3">
          {/* Type selector */}
          <div className="flex gap-1 flex-wrap">
            {Object.entries(TYPE_META).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setForm(f => ({ ...f, type: k as Post["type"] }))}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${form.type === k ? "bg-indigo-600 text-white border-indigo-600" : `border-slate-200 text-slate-600 ${v.colors.split(" ")[0]} hover:opacity-80`}`}
              >
                {v.emoji} {v.label}
              </button>
            ))}
          </div>

          {/* Scope selector */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { v: "global", l: "🌍 Global" },
              { v: "national", l: "🏳️ My Nation", disabled: !profile.nationId },
              { v: "city", l: "🏙️ My City", disabled: !profile.cityId },
            ].map(s => (
              <button
                key={s.v}
                onClick={() => !s.disabled && setForm(f => ({ ...f, scope: s.v as Post["scope"] }))}
                disabled={s.disabled}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${form.scope === s.v ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
              >
                {s.l}
              </button>
            ))}
          </div>

          <Textarea
            label="Your message"
            placeholder="Share with the movement…"
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={4}
          />

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={submit} loading={saving} disabled={!form.body.trim()}>Post</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Post Modal */}
      <Modal open={!!editPost} onClose={() => setEditPost(null)} title="Edit Post" size="md">
        <div className="space-y-3">
          <Textarea
            label="Your message"
            value={editPost?.body || ""}
            onChange={e => setEditPost(prev => prev ? { ...prev, body: e.target.value } : null)}
            rows={4}
          />
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setEditPost(null)}>Cancel</Button>
            <Button className="flex-1" onClick={saveEditPost} loading={editSaving}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Post?" size="sm">
        <p className="text-sm text-slate-600 mb-4">This cannot be undone.</p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => deletePost(deleteConfirm!)}>Delete</Button>
        </div>
      </Modal>

      {/* Report Modal */}
      <Modal open={!!reportPostId} onClose={() => setReportPostId(null)} title="Report Post" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Why are you reporting this post?</p>
          <div className="space-y-2">
            {["Spam or misleading", "Inappropriate content", "Harassment", "Off-topic"].map(r => (
              <button key={r} onClick={() => setReportReason(r)} className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${reportReason === r ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}>{r}</button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setReportPostId(null)}>Cancel</Button>
            <Button className="flex-1" onClick={submitReport} disabled={!reportReason}>Submit Report</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
