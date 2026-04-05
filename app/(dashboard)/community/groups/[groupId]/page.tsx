"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc, getDoc, collection, getDocs, query, orderBy, addDoc, serverTimestamp,
  where, updateDoc, deleteDoc, setDoc, increment, limit,
} from "firebase/firestore";
import { ArrowLeft, Send, Users, Pin, Heart, ThumbsUp, HandHeart, UserPlus, UserMinus, MoreHorizontal, Pencil, Trash2, Flag, Camera } from "lucide-react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import Link from "next/link";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/Spinner";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Group, GroupPost, GroupMember } from "@/lib/types";

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reacted, setReacted] = useState<Record<string, string>>({});
  const [joiningLeaving, setJoiningLeaving] = useState(false);
  const [tab, setTab] = useState<"feed" | "members">("feed");

  // Edit / delete / report state
  const [editPost, setEditPost] = useState<{ id: string; body: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => {
    if (!profile || !groupId) return;
    const load = async () => {
      try {
        const [groupSnap, postsSnap, membersSnap] = await Promise.all([
          getDoc(doc(db, COLLECTIONS.GROUPS, groupId)),
          getDocs(query(collection(db, COLLECTIONS.GROUP_POSTS), where("groupId", "==", groupId), orderBy("isPinned", "desc"), orderBy("createdAt", "desc"), limit(50))),
          getDocs(query(collection(db, COLLECTIONS.GROUP_MEMBERS), where("groupId", "==", groupId))),
        ]);

        if (!groupSnap.exists()) { router.replace("/community/groups"); return; }
        setGroup({ id: groupSnap.id, ...groupSnap.data() } as Group);
        setPosts(postsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupPost)));
        setMembers(membersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupMember)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [profile, groupId, router]);

  const isMember = members.some((m) => m.userId === profile?.id);
  const isLeader = members.some((m) => m.userId === profile?.id && m.role === "leader") || profile?.id === group?.leaderId;

  const post = async () => {
    if (!profile || !newPost.trim()) return;
    setPosting(true);
    try {
      const data = {
        groupId,
        authorId: profile.id,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL || null,
        body: newPost.trim(),
        commentCount: 0,
        reactionCounts: { like: 0, heart: 0, pray: 0 },
        isPinned: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, COLLECTIONS.GROUP_POSTS), data);
      setPosts((prev) => [{ id: ref.id, ...data } as any, ...prev]);
      setNewPost("");
    } catch (e) {
      toast.error("Failed to post.");
    } finally {
      setPosting(false);
    }
  };

  const react = async (postId: string, type: "like" | "heart" | "pray") => {
    if (!profile || reacted[postId]) return;
    setReacted(prev => ({ ...prev, [postId]: type }));
    try {
      await updateDoc(doc(db, COLLECTIONS.GROUP_POSTS, postId), { [`reactionCounts.${type}`]: increment(1) });
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, reactionCounts: { ...p.reactionCounts, [type]: ((p.reactionCounts?.[type] as number) || 0) + 1 } as any }
        : p));
    } catch (e) { console.error(e); }
  };

  const togglePin = async (postId: string, current: boolean) => {
    if (!isLeader) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.GROUP_POSTS, postId), { isPinned: !current });
      setPosts(prev => {
        const updated = prev.map(p => p.id === postId ? { ...p, isPinned: !current } : p);
        return [...updated.filter(p => p.isPinned), ...updated.filter(p => !p.isPinned)];
      });
    } catch (e) { toast.error("Failed to pin."); }
  };

  const joinGroup = async () => {
    if (!profile || joiningLeaving) return;
    setJoiningLeaving(true);
    try {
      const memberId = `${groupId}_${profile.id}`;
      await setDoc(doc(db, COLLECTIONS.GROUP_MEMBERS, memberId), {
        groupId,
        userId: profile.id,
        userName: profile.displayName,
        userPhoto: profile.photoURL || null,
        role: "member",
        joinedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, COLLECTIONS.GROUPS, groupId), { memberCount: increment(1) });
      setMembers(prev => [...prev, { id: memberId, groupId, userId: profile.id, userName: profile.displayName, userPhoto: profile.photoURL, role: "member", joinedAt: null as any }]);
      toast.success("Joined group!");
    } catch (e) { toast.error("Failed to join."); }
    finally { setJoiningLeaving(false); }
  };

  const leaveGroup = async () => {
    if (!profile || joiningLeaving || isLeader) return;
    setJoiningLeaving(true);
    try {
      const memberId = `${groupId}_${profile.id}`;
      await deleteDoc(doc(db, COLLECTIONS.GROUP_MEMBERS, memberId));
      await updateDoc(doc(db, COLLECTIONS.GROUPS, groupId), { memberCount: increment(-1) });
      setMembers(prev => prev.filter(m => m.userId !== profile.id));
      toast.success("Left group.");
    } catch (e) { toast.error("Failed to leave."); }
    finally { setJoiningLeaving(false); }
  };

  const saveEditPost = async () => {
    if (!editPost || !editPost.body.trim()) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.GROUP_POSTS, editPost.id), { body: editPost.body.trim(), updatedAt: serverTimestamp() });
      setPosts(prev => prev.map(p => p.id === editPost.id ? { ...p, body: editPost.body.trim() } : p));
      setEditPost(null);
      toast.success("Post updated.");
    } catch (e) { toast.error("Failed to update."); }
    finally { setEditSaving(false); }
  };

  const deleteGroupPost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.GROUP_POSTS, postId));
      setPosts(prev => prev.filter(p => p.id !== postId));
      setDeleteConfirmId(null);
      toast.success("Post deleted.");
    } catch (e) { toast.error("Failed to delete."); }
  };

  const submitReport = async () => {
    if (!profile || !reportPostId || !reportReason) return;
    try {
      await addDoc(collection(db, "reports"), {
        postId: reportPostId,
        postType: "group_post",
        reporterId: profile.id,
        reporterName: profile.displayName,
        reason: reportReason,
        createdAt: serverTimestamp(),
      });
      setReportPostId(null);
      setReportReason("");
      toast.success("Report submitted.");
    } catch (e) { toast.error("Failed to submit report."); }
  };

  if (loading) return <PageLoader />;
  if (!group) return null;

  const pinnedPosts = posts.filter(p => p.isPinned);
  const regularPosts = posts.filter(p => !p.isPinned);

  // Deterministic cover gradient
  const GRADIENTS = ["from-indigo-500 to-violet-600","from-teal-500 to-emerald-600","from-rose-500 to-pink-600","from-amber-500 to-orange-500","from-blue-500 to-cyan-600","from-violet-500 to-purple-600"];
  let gh = 0; for (let i = 0; i < group.name.length; i++) gh += group.name.charCodeAt(i);
  const coverGradient = GRADIENTS[gh % GRADIENTS.length];

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">

      {/* ── COVER BANNER ── */}
      <div className="relative h-36 rounded-2xl overflow-hidden mb-0">
        {/* Cover image or gradient background */}
        {group.coverImage ? (
          <img src={group.coverImage} alt="Group cover" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-r ${coverGradient}`}>
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
          </div>
        )}

        {/* Leader: upload cover photo (transparent overlay) */}
        {isLeader && (
          <div className="absolute inset-0 z-10">
            <ImageUpload
              currentUrl={null}
              storagePath={`groups/${groupId}/cover`}
              onUploadComplete={async (url) => {
                await updateDoc(doc(db, COLLECTIONS.GROUPS, groupId), { coverImage: url });
                setGroup(prev => prev ? { ...prev, coverImage: url } : prev);
                toast.success("Cover photo updated.");
              }}
              shape="rect"
              size="lg"
              placeholder={<span className="sr-only">Upload cover</span>}
              className="!rounded-none w-full h-full"
            />
          </div>
        )}

        {/* Back button */}
        <Link href="/community/groups" className="absolute top-3 left-3 p-2 rounded-xl bg-black/20 backdrop-blur-sm text-white hover:bg-black/30 transition-colors z-20">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        {/* Leader cover upload hint */}
        {isLeader && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/30 backdrop-blur-sm text-white text-[10px] font-semibold pointer-events-none z-20">
            <Camera className="w-3 h-3" />
            Edit cover
          </div>
        )}
        {/* Action buttons */}
        <div className="absolute top-3 right-3 flex gap-2 z-20">
          {!isMember && (
            <button onClick={joinGroup} disabled={joiningLeaving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-indigo-700 text-xs font-bold shadow-sm hover:bg-indigo-50 transition-colors disabled:opacity-50">
              <UserPlus className="w-3.5 h-3.5" />Join
            </button>
          )}
          {isMember && !isLeader && (
            <button onClick={leaveGroup} disabled={joiningLeaving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/20 backdrop-blur-sm text-white text-xs font-semibold hover:bg-black/30 transition-colors disabled:opacity-50">
              <UserMinus className="w-3.5 h-3.5" />Leave
            </button>
          )}
        </div>
      </div>

      {/* ── GROUP IDENTITY CARD ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm -mt-5 mx-3 relative z-10 px-4 pt-4 pb-0 mb-4">
        <div className="flex items-start gap-3 mb-3">
          {/* Group icon */}
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${coverGradient} flex items-center justify-center flex-shrink-0 shadow-md -mt-8 ring-3 ring-white`}>
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-slate-900">{group.name}</h1>
              {isMember && <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Joined</span>}
            </div>
            {group.description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{group.description}</p>}
          </div>
        </div>

        {/* Member avatars strip */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-50">
          <div className="flex -space-x-2">
            {members.slice(0, 5).map(m => (
              <div key={m.id} className="ring-2 ring-white rounded-full flex-shrink-0">
                <Avatar name={m.userName} photoURL={m.userPhoto} size="xs" />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-900">{members.length}</span> member{members.length !== 1 ? "s" : ""}
            {members.length > 0 && <span className="text-slate-400"> · </span>}
            {members.length > 0 && <span className="text-emerald-600 font-semibold">Active</span>}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {(["feed", "members"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-700"}`}
            >
              {t === "feed" ? `Feed` : `Members`}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: FEED ── */}
      {tab === "feed" && (
        <div className="space-y-3">
          {/* Pinned posts */}
          {pinnedPosts.map(p => (
            <PostCard
              key={p.id}
              post={p}
              isLeader={isLeader}
              currentUserId={profile?.id || ""}
              reacted={reacted}
              onReact={react}
              onPin={togglePin}
              onEdit={(id, body) => setEditPost({ id, body })}
              onDelete={(id) => setDeleteConfirmId(id)}
              onReport={(id) => setReportPostId(id)}
            />
          ))}

          {/* Compose */}
          {isMember && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex gap-3">
                <Avatar name={profile?.displayName || ""} photoURL={profile?.photoURL} size="sm" className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <textarea
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-slate-50 focus:bg-white transition-colors"
                    placeholder={`Share something with ${group.name}…`}
                    rows={3}
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) post(); }}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-slate-400">Ctrl+Enter to post</p>
                    <Button size="sm" onClick={post} loading={posting} disabled={!newPost.trim()}>
                      <Send className="w-3.5 h-3.5" />Post
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {regularPosts.length === 0 && pinnedPosts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-12 text-center">
              <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-400">No posts yet</p>
              {isMember && <p className="text-xs text-slate-400 mt-1">Be the first to share something!</p>}
            </div>
          ) : (
            regularPosts.map(p => (
              <PostCard
                key={p.id}
                post={p}
                isLeader={isLeader}
                currentUserId={profile?.id || ""}
                reacted={reacted}
                onReact={react}
                onPin={togglePin}
                onEdit={(id, body) => setEditPost({ id, body })}
                onDelete={(id) => setDeleteConfirmId(id)}
                onReport={(id) => setReportPostId(id)}
              />
            ))
          )}
        </div>
      )}

      {/* ── TAB: MEMBERS ── */}
      {tab === "members" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">{members.length} Members</p>
          <div className="space-y-2">
            {members.map(m => (
              <Link key={m.id} href={`/profile/${m.userId}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="relative flex-shrink-0">
                  <Avatar name={m.userName} photoURL={m.userPhoto} size="sm" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{m.userName}</p>
                  {m.role === "leader" && <p className="text-xs text-indigo-600 font-medium">Group Leader</p>}
                </div>
                <span className="text-xs text-slate-400 group-hover:text-indigo-600 transition-colors">View →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── EDIT POST MODAL ── */}
      <Modal open={!!editPost} onClose={() => setEditPost(null)} title="Edit Post" size="md">
        <div className="space-y-3">
          <textarea
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={4}
            value={editPost?.body || ""}
            onChange={e => setEditPost(prev => prev ? { ...prev, body: e.target.value } : null)}
          />
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setEditPost(null)}>Cancel</Button>
            <Button className="flex-1" onClick={saveEditPost} loading={editSaving}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* ── DELETE CONFIRM MODAL ── */}
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Post?" size="sm">
        <p className="text-sm text-slate-600 mb-4">This cannot be undone.</p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          <Button className="flex-1 !bg-red-600 hover:!bg-red-700" onClick={() => deleteGroupPost(deleteConfirmId!)}>Delete</Button>
        </div>
      </Modal>

      {/* ── REPORT MODAL ── */}
      <Modal open={!!reportPostId} onClose={() => setReportPostId(null)} title="Report Post" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Why are you reporting this?</p>
          <div className="space-y-2">
            {["Spam or misleading", "Inappropriate content", "Harassment", "Off-topic"].map(r => (
              <button
                key={r}
                onClick={() => setReportReason(r)}
                className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${reportReason === r ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}
              >
                {r}
              </button>
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

function PostCard({
  post, isLeader, currentUserId, reacted, onReact, onPin, onEdit, onDelete, onReport,
}: {
  post: GroupPost;
  isLeader: boolean;
  currentUserId: string;
  reacted: Record<string, string>;
  onReact: (id: string, type: "like" | "heart" | "pray") => void;
  onPin: (id: string, current: boolean) => void;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      {post.isPinned && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold mb-3">
          <Pin className="w-3 h-3" /> Pinned
        </div>
      )}
      <div className="flex gap-3">
        <Avatar name={post.authorName} photoURL={post.authorPhoto} size="sm" className="flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900 text-sm">{post.authorName}</p>
              <p className="text-xs text-slate-400">{timeAgo(post.createdAt)}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* 3-dot menu */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-slate-500"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-7 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 min-w-[130px]">
                    {post.authorId === currentUserId ? (
                      <>
                        <button onClick={() => { onEdit(post.id, post.body); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Pencil className="w-3.5 h-3.5" />Edit</button>
                        <button onClick={() => { onDelete(post.id); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" />Delete</button>
                      </>
                    ) : (
                      <button onClick={() => { onReport(post.id); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Flag className="w-3.5 h-3.5" />Report</button>
                    )}
                    {isLeader && post.authorId !== currentUserId && (
                      <button onClick={() => { onDelete(post.id); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50 mt-1"><Trash2 className="w-3.5 h-3.5" />Remove Post</button>
                    )}
                  </div>
                )}
              </div>
              {/* Pin button (leaders only) */}
              {isLeader && (
                <button
                  onClick={() => onPin(post.id, !!post.isPinned)}
                  className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${post.isPinned ? "text-amber-500 bg-amber-50" : "text-slate-400 hover:bg-slate-100"}`}
                  title={post.isPinned ? "Unpin" : "Pin to top"}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-700 mt-2 whitespace-pre-line leading-relaxed">{post.body}</p>
        </div>
      </div>

      {/* Reactions */}
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-50 flex-wrap">
        {(["like", "heart", "pray"] as const).map(r => {
          const icons = { like: ThumbsUp, heart: Heart, pray: HandHeart };
          const labels = { like: "Like", heart: "Amen", pray: "Pray" };
          const Icon = icons[r];
          const isActive = reacted[post.id] === r;
          const count = (post.reactionCounts as any)?.[r] || 0;
          return (
            <button
              key={r}
              onClick={() => onReact(post.id, r)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${isActive ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-100 text-slate-500"}`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "fill-indigo-500" : ""}`} />
              {count > 0 ? count : ""} {labels[r]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
