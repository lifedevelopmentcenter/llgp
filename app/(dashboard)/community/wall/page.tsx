"use client";
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, addDoc, serverTimestamp,
  updateDoc, doc, increment, limit, where, deleteDoc,
} from "firebase/firestore";
import { Heart, MessageSquare, Plus, Star, Send, MoreHorizontal, Pencil, Trash2, Flag } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Input";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Testimony, Comment } from "@/lib/types";

const TABS = [
  { key: "all", label: "All" },
  { key: "testimony", label: "Testimonies" },
  { key: "prayer_request", label: "Prayer Requests" },
];

export default function WallPage() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Testimony[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "testimony" | "prayer_request">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", type: "testimony" as "testimony" | "prayer_request" });
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [encouraged, setEncouraged] = useState<Set<string>>(new Set());

  // Edit / delete post
  const [editPost, setEditPost] = useState<{ id: string; title: string; body: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Delete comment
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  // Read-more expansion
  const [expandedBody, setExpandedBody] = useState<Set<string>>(new Set());

  // 3-dot menu
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Report
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, COLLECTIONS.TESTIMONIES), orderBy("createdAt", "desc"), limit(50)));
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Testimony)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const loadComments = async (postId: string) => {
    if (comments[postId]) return;
    try {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.COMMENTS),
        where("parentId", "==", postId),
        orderBy("createdAt")
      ));
      setComments(prev => ({ ...prev, [postId]: snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)) }));
    } catch (e) { console.error(e); }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); }
    else { setExpandedId(id); loadComments(id); setCommentText(""); }
  };

  const encourage = async (postId: string) => {
    if (!profile || encouraged.has(postId)) return;
    setEncouraged(prev => new Set([...prev, postId]));
    try {
      await updateDoc(doc(db, COLLECTIONS.TESTIMONIES, postId), { encouragementCount: increment(1) });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, encouragementCount: p.encouragementCount + 1 } : p));
    } catch (e) { console.error(e); }
  };

  const addComment = async (postId: string) => {
    if (!profile || !commentText.trim()) return;
    setCommentSaving(true);
    try {
      const data = { parentId: postId, parentType: "testimony" as const, authorId: profile.id, authorName: profile.displayName, authorPhoto: profile.photoURL || null, body: commentText.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      const ref = await addDoc(collection(db, COLLECTIONS.COMMENTS), data);
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), { id: ref.id, ...data } as any] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
      setCommentText("");
    } catch (e) { toast.error("Failed to comment."); }
    finally { setCommentSaving(false); }
  };

  const submit = async () => {
    if (!profile || !form.title || !form.body) return;
    setSaving(true);
    try {
      const data = { ...form, authorId: profile.id, authorName: profile.displayName, authorPhoto: profile.photoURL || null, nationName: profile.nationName || null, commentCount: 0, encouragementCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      const ref = await addDoc(collection(db, COLLECTIONS.TESTIMONIES), data);
      setPosts(prev => [{ id: ref.id, ...data } as any, ...prev]);
      setModalOpen(false);
      setForm({ title: "", body: "", type: "testimony" });
      toast.success("Shared with the community!");
    } catch (e) { toast.error("Failed to post."); }
    finally { setSaving(false); }
  };

  const saveEditPost = async () => {
    if (!editPost || !editPost.body.trim()) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.TESTIMONIES, editPost.id), { title: editPost.title.trim(), body: editPost.body.trim(), updatedAt: serverTimestamp() });
      setPosts(prev => prev.map(p => p.id === editPost.id ? { ...p, title: editPost.title.trim(), body: editPost.body.trim() } : p));
      setEditPost(null);
      toast.success("Updated.");
    } catch (e) { toast.error("Failed to update."); }
    finally { setEditSaving(false); }
  };

  const deletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.TESTIMONIES, postId));
      setPosts(prev => prev.filter(p => p.id !== postId));
      setDeleteConfirm(null);
      toast.success("Deleted.");
    } catch (e) { toast.error("Failed to delete."); }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.COMMENTS, commentId));
      setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
    } catch (e) { toast.error("Failed to delete."); }
  };

  const submitReport = async () => {
    if (!profile || !reportPostId || !reportReason) return;
    try {
      await addDoc(collection(db, "reports"), { postId: reportPostId, postType: "testimony", reporterId: profile.id, reporterName: profile.displayName, reason: reportReason, createdAt: serverTimestamp() });
      setReportPostId(null);
      setReportReason("");
      toast.success("Report submitted.");
    } catch (e) { toast.error("Failed to submit report."); }
  };

  const filtered = posts.filter(p => tab === "all" || p.type === tab);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in" onClick={() => setMenuOpenId(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Prayer & Testimony</h1>
          <p className="text-sm text-slate-400 mt-0.5">Encourage each other across the globe</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Share
        </Button>
      </div>

      {/* Compose teaser */}
      <button
        onClick={() => setModalOpen(true)}
        className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-all duration-150 text-left"
      >
        <Avatar name={profile?.displayName ?? "?"} photoURL={profile?.photoURL} size="sm" />
        <span className="text-sm text-slate-400 flex-1">Share a testimony or prayer request…</span>
        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <Plus className="w-4 h-4 text-white" />
        </div>
      </button>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 p-1 shadow-sm">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-150 ${tab === t.key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Star className="w-6 h-6" />}
          title="Nothing here yet"
          description="Be the first to share."
          action={<Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" />Share</Button>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <div key={post.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4">
                {/* Author */}
                <div className="flex items-start gap-3 mb-3">
                  <Avatar name={post.authorName} photoURL={post.authorPhoto} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900">{post.authorName}</p>
                      {post.nationName && <span className="text-xs text-slate-400">· {post.nationName}</span>}
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        post.type === "testimony" ? "bg-green-100 text-green-700"
                        : post.type === "prayer_request" ? "bg-blue-100 text-blue-700"
                        : "bg-cyan-100 text-cyan-700"
                      }`}>
                        {post.type === "testimony" ? "✦ Testimony" : post.type === "prayer_request" ? "🙏 Prayer" : "📊 Poll"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{timeAgo(post.createdAt)}</p>
                  </div>
                  {/* 3-dot menu */}
                  <div className="relative ml-1 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === post.id ? null : post.id); }}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-slate-500"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {menuOpenId === post.id && (
                      <div className="absolute right-0 top-7 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 min-w-[130px]">
                        {post.authorId === profile?.id ? (
                          <>
                            <button onClick={() => { setEditPost({ id: post.id, title: post.title, body: post.body }); setMenuOpenId(null); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Pencil className="w-3.5 h-3.5" />Edit</button>
                            <button onClick={() => { setDeleteConfirm(post.id); setMenuOpenId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" />Delete</button>
                          </>
                        ) : (
                          <button onClick={() => { setReportPostId(post.id); setMenuOpenId(null); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Flag className="w-3.5 h-3.5" />Report</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 mb-1.5">{post.title}</h3>

                {/* Read-more body */}
                {(() => {
                  const isLong = post.body.length > 200;
                  const isExp = expandedBody.has(post.id);
                  return (
                    <div>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                        {isLong && !isExp ? post.body.slice(0, 200) + "…" : post.body}
                      </p>
                      {isLong && (
                        <button
                          onClick={() => setExpandedBody(prev => { const n = new Set(prev); isExp ? n.delete(post.id) : n.add(post.id); return n; })}
                          className="text-xs text-indigo-600 font-semibold mt-1 hover:underline"
                        >
                          {isExp ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Reactions */}
                <div className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-50">
                  <button
                    onClick={() => encourage(post.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      encouraged.has(post.id) ? "bg-rose-100 text-rose-600" : "hover:bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${encouraged.has(post.id) ? "fill-rose-500 text-rose-500" : ""}`} />
                    {post.encouragementCount > 0 ? post.encouragementCount : ""}
                    {post.type === "testimony" ? " Amen" : " Praying"}
                  </button>
                  <button
                    onClick={() => toggleExpand(post.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      expandedId === post.id ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-100 text-slate-500"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    {post.commentCount > 0 ? post.commentCount : ""}
                    {" Comment"}
                  </button>
                </div>
              </div>

              {/* Comments section */}
              {expandedId === post.id && (
                <div className="border-t border-slate-50 bg-slate-50/50 px-4 py-3 space-y-3">
                  {(comments[post.id] || []).map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <Avatar name={c.authorName} photoURL={c.authorPhoto} size="xs" className="flex-shrink-0 mt-0.5" />
                      <div className="bg-white rounded-xl px-3 py-2 shadow-sm flex-1">
                        <p className="text-xs font-bold text-slate-900">{c.authorName}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{c.body}</p>
                        {c.authorId === profile?.id && (
                          <button onClick={() => deleteComment(post.id, c.id)} className="text-[10px] text-red-400 hover:text-red-600 mt-0.5">
                            delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 items-center pt-1">
                    <Avatar name={profile?.displayName ?? "?"} photoURL={profile?.photoURL} size="xs" className="flex-shrink-0" />
                    <input
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Write a response…"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(post.id); } }}
                    />
                    <button
                      onClick={() => addComment(post.id)}
                      disabled={!commentText.trim() || commentSaving}
                      className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center transition-colors flex-shrink-0"
                    >
                      <Send className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Post Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Share with the community" size="md">
        <div className="space-y-3">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[{ v: "testimony", l: "✦ Testimony" }, { v: "prayer_request", l: "🙏 Prayer Request" }].map(t => (
              <button key={t.v} onClick={() => setForm({ ...form, type: t.v as any })}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${form.type === t.v ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
                {t.l}
              </button>
            ))}
          </div>
          <Input label="Title" placeholder="Brief title…" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Your message" placeholder={form.type === "testimony" ? "Share what God has done…" : "Share how others can pray for you…"} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={5} />
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={submit} loading={saving}>Share</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Post Modal */}
      <Modal open={!!editPost} onClose={() => setEditPost(null)} title="Edit Post" size="md">
        <div className="space-y-3">
          <Input label="Title" value={editPost?.title || ""} onChange={e => setEditPost(prev => prev ? { ...prev, title: e.target.value } : null)} />
          <Textarea label="Message" value={editPost?.body || ""} onChange={e => setEditPost(prev => prev ? { ...prev, body: e.target.value } : null)} rows={4} />
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
          <Button className="flex-1 !bg-red-600 hover:!bg-red-700" onClick={() => deletePost(deleteConfirm!)}>Delete</Button>
        </div>
      </Modal>

      {/* Report Modal */}
      <Modal open={!!reportPostId} onClose={() => setReportPostId(null)} title="Report Post" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Why are you reporting this?</p>
          <div className="space-y-2">
            {["Spam or misleading", "Inappropriate content", "Harassment", "Off-topic"].map(r => (
              <button key={r} onClick={() => setReportReason(r)} className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${reportReason === r ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}>{r}</button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setReportPostId(null)}>Cancel</Button>
            <Button className="flex-1" onClick={submitReport} disabled={!reportReason}>Submit</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
